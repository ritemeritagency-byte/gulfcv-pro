import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

async function ensureSchemaMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function migrationIdFromFile(fileName) {
  return fileName.replace(/\.up\.sql$/i, "");
}

async function readMigrationPairs(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const upFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".up.sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return upFiles.map((upName) => {
    const id = migrationIdFromFile(upName);
    return {
      id,
      upFilePath: path.join(dirPath, `${id}.up.sql`),
      downFilePath: path.join(dirPath, `${id}.down.sql`)
    };
  });
}

export async function getMigrationStatus(pool, options = {}) {
  const migrationsDir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR;
  await ensureSchemaMigrationsTable(pool);

  const pairs = await readMigrationPairs(migrationsDir);
  const appliedRows = (await pool.query("SELECT id, applied_at FROM schema_migrations ORDER BY id")).rows;
  const appliedMap = new Map(appliedRows.map((row) => [row.id, row.applied_at]));

  return pairs.map((pair) => ({
    id: pair.id,
    applied: appliedMap.has(pair.id),
    appliedAt: appliedMap.get(pair.id) || null
  }));
}

export async function runMigrationsUp(pool, options = {}) {
  const migrationsDir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR;
  await ensureSchemaMigrationsTable(pool);

  const pairs = await readMigrationPairs(migrationsDir);
  const appliedRows = (await pool.query("SELECT id FROM schema_migrations")).rows;
  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const pending = pairs.filter((pair) => !appliedIds.has(pair.id));
  const appliedNow = [];

  for (const migration of pending) {
    const sql = await fs.readFile(migration.upFilePath, "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      await client.query("COMMIT");
      appliedNow.push(migration.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied: appliedNow };
}

export async function runMigrationsDown(pool, options = {}) {
  const migrationsDir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR;
  const targetId = options.to || null;
  const steps = Number.isFinite(options.steps) ? Math.max(0, Math.trunc(options.steps)) : 1;

  await ensureSchemaMigrationsTable(pool);

  const pairs = await readMigrationPairs(migrationsDir);
  const pairMap = new Map(pairs.map((pair) => [pair.id, pair]));
  const appliedRows = (
    await pool.query("SELECT id FROM schema_migrations ORDER BY id DESC")
  ).rows.map((row) => row.id);

  let rollbackList = [];
  if (targetId) {
    rollbackList = appliedRows.filter((id) => id > targetId);
  } else {
    rollbackList = appliedRows.slice(0, steps);
  }

  const rolledBack = [];

  for (const id of rollbackList) {
    const pair = pairMap.get(id);
    if (!pair) {
      throw new Error(`Cannot rollback migration ${id}: missing migration files.`);
    }
    const sql = await fs.readFile(pair.downFilePath, "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
      await client.query("COMMIT");
      rolledBack.push(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return { rolledBack };
}
