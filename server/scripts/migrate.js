import dotenv from "dotenv";
import pg from "pg";
import { getMigrationStatus, runMigrationsDown, runMigrationsUp } from "../src/migrations.js";

dotenv.config();

const { Pool } = pg;

function parseBooleanEnv(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function getPoolFromEnv() {
  const NODE_ENV = process.env.NODE_ENV || "development";
  const DATABASE_URL = String(process.env.DATABASE_URL || "");
  const DATABASE_SSL = parseBooleanEnv(process.env.DATABASE_SSL, NODE_ENV === "production");
  const DATABASE_SSL_REJECT_UNAUTHORIZED = parseBooleanEnv(
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    false
  );

  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const config = {
    connectionString: DATABASE_URL
  };

  if (DATABASE_SSL) {
    config.ssl = { rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED };
  }

  return new Pool(config);
}

async function main() {
  const command = String(process.argv[2] || "up").toLowerCase();
  const toArgIndex = process.argv.findIndex((arg) => arg === "--to");
  const to = toArgIndex > -1 ? process.argv[toArgIndex + 1] : null;
  const stepsArgIndex = process.argv.findIndex((arg) => arg === "--steps");
  const stepsRaw = stepsArgIndex > -1 ? Number(process.argv[stepsArgIndex + 1]) : undefined;

  const pool = getPoolFromEnv();

  try {
    if (command === "up") {
      const result = await runMigrationsUp(pool);
      const applied = result.applied.length ? result.applied.join(", ") : "(none)";
      console.log(`Migrations applied: ${applied}`);
      return;
    }

    if (command === "down") {
      const result = await runMigrationsDown(pool, { to: to || null, steps: stepsRaw });
      const rolledBack = result.rolledBack.length ? result.rolledBack.join(", ") : "(none)";
      console.log(`Migrations rolled back: ${rolledBack}`);
      return;
    }

    if (command === "status") {
      const status = await getMigrationStatus(pool);
      if (!status.length) {
        console.log("No migration files found.");
        return;
      }
      status.forEach((row) => {
        const marker = row.applied ? "APPLIED" : "PENDING";
        console.log(`${marker}  ${row.id}${row.appliedAt ? `  (${row.appliedAt.toISOString()})` : ""}`);
      });
      return;
    }

    throw new Error("Unknown command. Use: up | down | status");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
