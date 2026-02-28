import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "crypto";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrationsUp } from "./migrations.js";

dotenv.config();

const { Pool } = pg;

const TEMPLATE_IDS = [
  "classic",
  "desert",
  "emerald",
  "royal",
  "sunrise",
  "slate",
  "ruby",
  "midnight",
  "ocean",
  "carbon"
];

const PLAN_CONFIG = {
  free: { name: "Free", cvLimit: 3, templates: ["classic"] },
  starter: { name: "Starter", cvLimit: 300, templates: ["classic", "desert", "emerald", "ruby"] },
  growth: {
    name: "Growth",
    cvLimit: 700,
    templates: ["classic", "desert", "emerald", "royal", "sunrise", "slate", "ruby", "ocean"]
  },
  enterprise: {
    name: "Scale",
    cvLimit: 1500,
    templates: TEMPLATE_IDS
  }
};

function parseBooleanEnv(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseIntEnv(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function parseOriginList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEmailList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function normalizeUrlBase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace(/\/+$/, "");
}

function parsePasswordResetDelivery(value) {
  const normalized = String(value || "log").trim().toLowerCase();
  if (normalized === "log" || normalized === "resend") {
    return normalized;
  }
  return "log";
}

function sanitizeText(value, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function currentMonthKey(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${mm}`;
}

function sha256Text(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function createPasswordResetToken() {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: sha256Text(rawToken)
  };
}

function parseCookieHeader(raw) {
  const cookies = {};
  const text = String(raw || "");
  if (!text) return cookies;
  for (const part of text.split(";")) {
    const [name, ...rest] = part.split("=");
    if (!name) continue;
    cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
}

function sanitizeSameSite(value) {
  const normalized = String(value || "lax").trim().toLowerCase();
  if (normalized === "strict" || normalized === "lax" || normalized === "none") {
    return normalized;
  }
  return "lax";
}

function createLogger() {
  function write(level, message, meta = {}) {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  return {
    info(message, meta) {
      write("info", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    error(message, meta) {
      write("error", message, meta);
    }
  };
}

function createRuntimeConfig(env = process.env) {
  const NODE_ENV = env.NODE_ENV || "development";
  const IS_PRODUCTION = NODE_ENV === "production";
  const PORT = parseIntEnv(env.PORT, 3000);

  const JWT_SECRET = String(env.JWT_SECRET || "");
  const ADMIN_JWT_SECRET = String(env.ADMIN_JWT_SECRET || JWT_SECRET);
  const DATABASE_URL = String(env.DATABASE_URL || "");
  const DATABASE_SSL = parseBooleanEnv(env.DATABASE_SSL, IS_PRODUCTION);
  const DATABASE_SSL_REJECT_UNAUTHORIZED = parseBooleanEnv(
    env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    false
  );

  const CORS_ORIGINS = parseOriginList(env.CORS_ORIGINS || env.FRONTEND_ORIGIN || "");
  const TRUST_PROXY = parseBooleanEnv(env.TRUST_PROXY, IS_PRODUCTION);
  const AUTO_APPROVE_PAYMENTS = parseBooleanEnv(env.AUTO_APPROVE_PAYMENTS, false);

  const SESSION_COOKIE_NAME = sanitizeText(env.SESSION_COOKIE_NAME || "gcc_session", 80);
  const ADMIN_SESSION_COOKIE_NAME = sanitizeText(
    env.ADMIN_SESSION_COOKIE_NAME || "gcc_admin_session",
    80
  );
  const COOKIE_DOMAIN = sanitizeText(env.COOKIE_DOMAIN || "", 160);
  const COOKIE_SAME_SITE = sanitizeSameSite(env.COOKIE_SAME_SITE || "lax");
  const COOKIE_SECURE = parseBooleanEnv(env.COOKIE_SECURE, IS_PRODUCTION);

  const AGENCY_SESSION_DAYS = Math.max(1, parseIntEnv(env.AGENCY_SESSION_DAYS, 7));
  const ADMIN_SESSION_HOURS = Math.max(1, parseIntEnv(env.ADMIN_SESSION_HOURS, 12));
  const AGENCY_SESSION_TTL_MS = AGENCY_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const ADMIN_SESSION_TTL_MS = ADMIN_SESSION_HOURS * 60 * 60 * 1000;

  const DB_POOL_SIZE = Math.max(1, parseIntEnv(env.DB_POOL_SIZE, 10));
  const DB_IDLE_TIMEOUT_MS = Math.max(1000, parseIntEnv(env.DB_IDLE_TIMEOUT_MS, 30000));
  const DB_CONNECT_TIMEOUT_MS = Math.max(1000, parseIntEnv(env.DB_CONNECT_TIMEOUT_MS, 10000));

  const RATE_LIMIT_STORE = String(env.RATE_LIMIT_STORE || (IS_PRODUCTION ? "postgres" : "memory"))
    .trim()
    .toLowerCase();

  const ADMIN_BOOTSTRAP_EMAIL = sanitizeText(env.ADMIN_BOOTSTRAP_EMAIL || "", 160).toLowerCase();
  const ADMIN_BOOTSTRAP_PASSWORD = String(env.ADMIN_BOOTSTRAP_PASSWORD || "");
  const ADMIN_ALLOWED_EMAILS = parseEmailList(
    env.ADMIN_ALLOWED_EMAILS || env.ADMIN_OWNER_EMAIL || env.ADMIN_BOOTSTRAP_EMAIL || ""
  );
  const PASSWORD_RESET_TOKEN_TTL_MINUTES = Math.min(
    180,
    Math.max(5, parseIntEnv(env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 30))
  );
  const PASSWORD_RESET_DELIVERY = parsePasswordResetDelivery(env.PASSWORD_RESET_DELIVERY);
  const PASSWORD_RESET_URL_BASE = normalizeUrlBase(
    env.PASSWORD_RESET_URL_BASE || CORS_ORIGINS[0] || ""
  );
  const RESEND_API_KEY = String(env.RESEND_API_KEY || "").trim();
  const RESEND_FROM_EMAIL = sanitizeText(env.RESEND_FROM_EMAIL || "", 160);

  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in server/.env");
  }
  if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in server/.env");
  }
  if (IS_PRODUCTION && JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }
  if (IS_PRODUCTION && ADMIN_JWT_SECRET.length < 32) {
    throw new Error("ADMIN_JWT_SECRET must be at least 32 characters in production.");
  }
  if (IS_PRODUCTION && CORS_ORIGINS.length === 0) {
    throw new Error("Set CORS_ORIGINS in production (comma-separated frontend origins).");
  }
  if (COOKIE_SAME_SITE === "none" && !COOKIE_SECURE) {
    throw new Error("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none.");
  }
  if (RATE_LIMIT_STORE !== "memory" && RATE_LIMIT_STORE !== "postgres") {
    throw new Error("RATE_LIMIT_STORE must be either 'memory' or 'postgres'.");
  }

  return {
    NODE_ENV,
    IS_PRODUCTION,
    PORT,
    JWT_SECRET,
    ADMIN_JWT_SECRET,
    DATABASE_URL,
    DATABASE_SSL,
    DATABASE_SSL_REJECT_UNAUTHORIZED,
    CORS_ORIGINS,
    TRUST_PROXY,
    AUTO_APPROVE_PAYMENTS,
    SESSION_COOKIE_NAME,
    ADMIN_SESSION_COOKIE_NAME,
    COOKIE_DOMAIN,
    COOKIE_SAME_SITE,
    COOKIE_SECURE,
    AGENCY_SESSION_TTL_MS,
    ADMIN_SESSION_TTL_MS,
    DB_POOL_SIZE,
    DB_IDLE_TIMEOUT_MS,
    DB_CONNECT_TIMEOUT_MS,
    RATE_LIMIT_STORE,
    ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD,
    ADMIN_ALLOWED_EMAILS,
    PASSWORD_RESET_TOKEN_TTL_MINUTES,
    PASSWORD_RESET_DELIVERY,
    PASSWORD_RESET_URL_BASE,
    RESEND_API_KEY,
    RESEND_FROM_EMAIL
  };
}

function createDbPool(cfg) {
  const poolConfig = {
    connectionString: cfg.DATABASE_URL,
    max: cfg.DB_POOL_SIZE,
    idleTimeoutMillis: cfg.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: cfg.DB_CONNECT_TIMEOUT_MS
  };
  if (cfg.DATABASE_SSL) {
    poolConfig.ssl = { rejectUnauthorized: cfg.DATABASE_SSL_REJECT_UNAUTHORIZED };
  }
  return new Pool(poolConfig);
}

function normalizeAgencyRow(row) {
  const planDefaults = PLAN_CONFIG[row.plan] || PLAN_CONFIG.free;
  const defaultTemplates = Array.isArray(planDefaults.templates) ? planDefaults.templates : [];
  const rowTemplates = Array.isArray(row.templates)
    ? row.templates.filter((templateId) => TEMPLATE_IDS.includes(templateId))
    : [];
  const templates = Array.from(new Set([...rowTemplates, ...defaultTemplates])).filter((templateId) =>
    TEMPLATE_IDS.includes(templateId)
  );

  return {
    id: row.id,
    agencyName: row.agency_name,
    email: row.email,
    plan: row.plan,
    planName: row.plan_name || planDefaults.name,
    cvLimit: row.cv_limit ?? planDefaults.cvLimit,
    cvsCreated: row.cvs_created ?? 0,
    templates,
    subscriptionStatus: row.subscription_status || "active",
    paymentMethod: row.payment_method || "",
    paymentReference: row.payment_reference || "",
    paymentNote: row.payment_note || "",
    lastResetMonth: row.last_reset_month || currentMonthKey(),
    profile: row.profile || {}
  };
}

function normalizeAdminRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}

function isAdminEmailAllowed(cfg, email) {
  if (!Array.isArray(cfg.ADMIN_ALLOWED_EMAILS) || cfg.ADMIN_ALLOWED_EMAILS.length === 0) {
    return true;
  }
  const normalized = sanitizeText(email, 160).toLowerCase();
  return cfg.ADMIN_ALLOWED_EMAILS.includes(normalized);
}

async function findAgencyByEmail(executor, email) {
  const result = await executor.query("SELECT * FROM agencies WHERE email = $1 LIMIT 1", [email]);
  return result.rows[0] || null;
}

async function findAgencyById(executor, id) {
  const result = await executor.query("SELECT * FROM agencies WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] || null;
}

async function findAdminByEmail(executor, email) {
  const result = await executor.query("SELECT * FROM admin_users WHERE email = $1 LIMIT 1", [email]);
  return result.rows[0] || null;
}

async function findAdminById(executor, id) {
  const result = await executor.query("SELECT * FROM admin_users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] || null;
}

async function saveMonthlyResetIfNeeded(executor, agencyRow) {
  const key = currentMonthKey();
  if (agencyRow.last_reset_month === key) {
    return agencyRow;
  }
  const updated = await executor.query(
    "UPDATE agencies SET cvs_created = 0, last_reset_month = $1 WHERE id = $2 RETURNING *",
    [key, agencyRow.id]
  );
  return updated.rows[0] || agencyRow;
}

function buildPasswordResetUrl(cfg, rawToken) {
  const token = encodeURIComponent(rawToken);
  if (!cfg.PASSWORD_RESET_URL_BASE) {
    return `auth?mode=reset&token=${token}`;
  }
  return `${cfg.PASSWORD_RESET_URL_BASE}/auth?mode=reset&token=${token}`;
}

async function sendPasswordResetLink({ cfg, logger, email, resetUrl, requestId }) {
  if (cfg.PASSWORD_RESET_DELIVERY === "resend") {
    if (!cfg.RESEND_API_KEY || !cfg.RESEND_FROM_EMAIL) {
      throw new Error("Resend delivery is not configured.");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: cfg.RESEND_FROM_EMAIL,
        to: [email],
        subject: "Reset your GulfCV Pro password",
        text: `Reset your GulfCV Pro password using this link: ${resetUrl}`,
        html: `<p>We received a request to reset your GulfCV Pro password.</p><p><a href="${resetUrl}">Reset Password</a></p><p>If you did not request this, you can ignore this email.</p>`
      })
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Resend request failed (${response.status}): ${errBody.slice(0, 300)}`);
    }
    return;
  }

  logger.info("password_reset_link_log_mode", {
    requestId,
    email,
    resetUrl
  });
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", [cookie]);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookie]);
    return;
  }
  res.setHeader("Set-Cookie", [String(existing), cookie]);
}

function buildCookieValue(name, value, cfg, maxAgeMs) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly"];
  if (cfg.COOKIE_DOMAIN) {
    parts.push(`Domain=${cfg.COOKIE_DOMAIN}`);
  }
  parts.push(`SameSite=${cfg.COOKIE_SAME_SITE}`);
  if (cfg.COOKIE_SECURE) {
    parts.push("Secure");
  }
  if (typeof maxAgeMs === "number") {
    const seconds = Math.max(0, Math.floor(maxAgeMs / 1000));
    parts.push(`Max-Age=${seconds}`);
  }
  return parts.join("; ");
}

function setAgencyCookie(res, token, cfg) {
  appendSetCookie(res, buildCookieValue(cfg.SESSION_COOKIE_NAME, token, cfg, cfg.AGENCY_SESSION_TTL_MS));
}

function clearAgencyCookie(res, cfg) {
  appendSetCookie(res, buildCookieValue(cfg.SESSION_COOKIE_NAME, "", cfg, 0));
}

function setAdminCookie(res, token, cfg) {
  appendSetCookie(
    res,
    buildCookieValue(cfg.ADMIN_SESSION_COOKIE_NAME, token, cfg, cfg.ADMIN_SESSION_TTL_MS)
  );
}

function clearAdminCookie(res, cfg) {
  appendSetCookie(res, buildCookieValue(cfg.ADMIN_SESSION_COOKIE_NAME, "", cfg, 0));
}

function getTokenFromRequest(req, cookieName) {
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookies = parseCookieHeader(req.headers.cookie || "");
  return cookies[cookieName] || "";
}

function createRateLimiterStore(cfg) {
  if (cfg.RATE_LIMIT_STORE === "postgres") {
    return { type: "postgres" };
  }
  return { type: "memory", buckets: new Map() };
}

function createRateLimiter({ cfg, pool, store, logger, windowMs, max, keyPrefix }) {
  async function incrementMemory(key, now) {
    const bucketKey = `${keyPrefix}:${key}`;
    let bucket = store.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (store.buckets.size > 20000 && Math.random() < 0.01) {
      for (const [mapKey, mapValue] of store.buckets.entries()) {
        if (mapValue.resetAt <= now) {
          store.buckets.delete(mapKey);
        }
      }
    }
    return { count: bucket.count, resetAt: bucket.resetAt };
  }

  async function incrementPostgres(key, now) {
    const bucketKey = `${keyPrefix}:${key}`;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const result = await pool.query(
      `INSERT INTO api_rate_limits (bucket_key, window_start, request_count, expires_at)
       VALUES ($1, to_timestamp($2 / 1000.0), 1, to_timestamp($3 / 1000.0))
       ON CONFLICT (bucket_key, window_start)
       DO UPDATE SET request_count = api_rate_limits.request_count + 1, expires_at = EXCLUDED.expires_at
       RETURNING request_count`,
      [bucketKey, windowStart, resetAt]
    );

    if (Math.random() < 0.005) {
      pool
        .query("DELETE FROM api_rate_limits WHERE expires_at < NOW()")
        .catch((error) => logger.warn("rate_limit_cleanup_failed", { error: error.message }));
    }

    return { count: Number(result.rows[0]?.request_count || 1), resetAt };
  }

  return (req, res, next) => {
    const now = Date.now();
    const clientId = req.ip || req.socket?.remoteAddress || "unknown";
    const execute =
      store.type === "postgres" ? incrementPostgres(clientId, now) : incrementMemory(clientId, now);

    Promise.resolve(execute)
      .then(({ count, resetAt }) => {
        res.setHeader("X-RateLimit-Limit", String(max));
        res.setHeader("X-RateLimit-Remaining", String(Math.max(max - count, 0)));
        res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
        if (count > max) {
          res.status(429).json({ error: "Too many requests. Please try again shortly." });
          return;
        }
        next();
      })
      .catch((error) => {
        logger.warn("rate_limit_error", { error: error.message, keyPrefix, store: store.type });
        next();
      });
  };
}

async function ensureBootstrapAdmin(pool, cfg, logger) {
  if (!cfg.ADMIN_BOOTSTRAP_EMAIL || !cfg.ADMIN_BOOTSTRAP_PASSWORD) {
    return;
  }
  if (!isValidEmail(cfg.ADMIN_BOOTSTRAP_EMAIL)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL is invalid.");
  }
  if (!isAdminEmailAllowed(cfg, cfg.ADMIN_BOOTSTRAP_EMAIL)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL must be included in ADMIN_ALLOWED_EMAILS.");
  }
  if (cfg.ADMIN_BOOTSTRAP_PASSWORD.length < 12) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }
  const existing = await findAdminByEmail(pool, cfg.ADMIN_BOOTSTRAP_EMAIL);
  if (existing) {
    return;
  }
  const passwordHash = await bcrypt.hash(cfg.ADMIN_BOOTSTRAP_PASSWORD, 12);
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'super_admin', TRUE)`,
    [randomUUID(), cfg.ADMIN_BOOTSTRAP_EMAIL, passwordHash]
  );
  logger.info("bootstrap_admin_created", { email: cfg.ADMIN_BOOTSTRAP_EMAIL });
}

function safeRequestId(value) {
  const clean = sanitizeText(value || "", 80);
  if (!clean) return randomUUID();
  return /^[a-zA-Z0-9._:-]{6,80}$/.test(clean) ? clean : randomUUID();
}

function createApp({ cfg, pool, logger, rateLimiterStore }) {
  const app = express();

  if (cfg.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.use((req, res, next) => {
    req.requestId = safeRequestId(req.headers["x-request-id"]);
    res.setHeader("X-Request-Id", req.requestId);
    const start = Date.now();
    res.on("finish", () => {
      logger.info("request_complete", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ip: req.ip || req.socket?.remoteAddress || "unknown"
      });
    });
    next();
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (cfg.IS_PRODUCTION) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (!cfg.IS_PRODUCTION) return callback(null, true);
        if (cfg.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error("CORS_NOT_ALLOWED"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "x-request-id"],
      maxAge: 86400
    })
  );

  app.use((req, res, next) => {
    const method = String(req.method || "GET").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next();
    }
    const origin = String(req.headers.origin || "");
    if (!origin || !cfg.IS_PRODUCTION) {
      return next();
    }
    if (cfg.CORS_ORIGINS.includes(origin)) {
      return next();
    }
    return res.status(403).json({ error: "Origin not allowed" });
  });

  const globalLimiter = createRateLimiter({
    cfg,
    pool,
    store: rateLimiterStore,
    logger,
    windowMs: 15 * 60 * 1000,
    max: 800,
    keyPrefix: "global"
  });
  const authLimiter = createRateLimiter({
    cfg,
    pool,
    store: rateLimiterStore,
    logger,
    windowMs: 10 * 60 * 1000,
    max: 90,
    keyPrefix: "auth"
  });
  const loginLimiter = createRateLimiter({
    cfg,
    pool,
    store: rateLimiterStore,
    logger,
    windowMs: 10 * 60 * 1000,
    max: 25,
    keyPrefix: "login"
  });
  const adminLimiter = createRateLimiter({
    cfg,
    pool,
    store: rateLimiterStore,
    logger,
    windowMs: 10 * 60 * 1000,
    max: 100,
    keyPrefix: "admin"
  });

  app.use(globalLimiter);
  app.use(express.json({ limit: "2mb" }));

  function issueAgencySession(res, agencyId) {
    const token = jwt.sign({ sub: agencyId, typ: "agency" }, cfg.JWT_SECRET, {
      expiresIn: Math.floor(cfg.AGENCY_SESSION_TTL_MS / 1000),
      algorithm: "HS256"
    });
    setAgencyCookie(res, token, cfg);
  }

  function issueAdminSession(res, adminId, role) {
    const token = jwt.sign({ sub: adminId, typ: "admin", role }, cfg.ADMIN_JWT_SECRET, {
      expiresIn: Math.floor(cfg.ADMIN_SESSION_TTL_MS / 1000),
      algorithm: "HS256"
    });
    setAdminCookie(res, token, cfg);
  }

  function authRequired(req, res, next) {
    const token = getTokenFromRequest(req, cfg.SESSION_COOKIE_NAME);
    if (!token) {
      return res.status(401).json({ error: "Missing session" });
    }
    try {
      const payload = jwt.verify(token, cfg.JWT_SECRET, { algorithms: ["HS256"] });
      if (!payload?.sub || typeof payload.sub !== "string" || payload.typ !== "agency") {
        return res.status(401).json({ error: "Invalid session" });
      }
      req.agencyId = payload.sub;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid session" });
    }
  }

  async function adminRequired(req, res, next) {
    const token = getTokenFromRequest(req, cfg.ADMIN_SESSION_COOKIE_NAME);
    if (!token) {
      return res.status(401).json({ error: "Missing admin session" });
    }
    let payload;
    try {
      payload = jwt.verify(token, cfg.ADMIN_JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ error: "Invalid admin session" });
    }
    if (!payload?.sub || typeof payload.sub !== "string" || payload.typ !== "admin") {
      return res.status(401).json({ error: "Invalid admin session" });
    }
    try {
      const row = await findAdminById(pool, payload.sub);
      if (!row || !row.is_active) {
        return res.status(401).json({ error: "Admin account is inactive" });
      }
      if (!isAdminEmailAllowed(cfg, row.email)) {
        return res.status(403).json({ error: "Admin access is restricted." });
      }
      req.adminId = row.id;
      req.adminRole = row.role || "admin";
      return next();
    } catch (error) {
      logger.error("admin_session_validate_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to validate admin session" });
    }
  }

  app.get("/api/health", async (_req, res) => {
    const started = Date.now();
    try {
      await pool.query("SELECT 1");
      return res.json({
        ok: true,
        env: cfg.NODE_ENV,
        db: { ok: true, latencyMs: Date.now() - started },
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime())
      });
    } catch (error) {
      return res.status(503).json({
        ok: false,
        env: cfg.NODE_ENV,
        db: { ok: false, error: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/plans", (_req, res) => {
    res.json({ plans: PLAN_CONFIG });
  });

  app.post("/api/auth/signup", authLimiter, loginLimiter, async (req, res) => {
    try {
      const { agencyName, email, password, plan } = req.body || {};
      const cleanAgencyName = sanitizeText(agencyName, 120);
      const normalizedEmail = sanitizeText(email, 160).toLowerCase();
      const passwordText = String(password || "");
      const selectedPlan = sanitizeText(plan, 40);

      if (!cleanAgencyName || !normalizedEmail || !passwordText || !selectedPlan) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (passwordText.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      if (!PLAN_CONFIG[selectedPlan]) {
        return res.status(400).json({ error: "Invalid plan" });
      }

      const existing = await findAgencyByEmail(pool, normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(passwordText, 12);
      const planConfig = PLAN_CONFIG[selectedPlan];
      const id = randomUUID();

      await pool.query(
        `INSERT INTO agencies
          (id, agency_name, email, password_hash, plan, plan_name, cv_limit, cvs_created, templates, subscription_status, last_reset_month, profile)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)`,
        [
          id,
          cleanAgencyName,
          normalizedEmail,
          hashedPassword,
          selectedPlan,
          planConfig.name,
          planConfig.cvLimit,
          0,
          JSON.stringify(planConfig.templates),
          "active",
          currentMonthKey(),
          JSON.stringify({})
        ]
      );

      const agency = normalizeAgencyRow(await findAgencyById(pool, id));
      issueAgencySession(res, agency.id);
      return res.status(201).json({ agency });
    } catch (error) {
      logger.error("signup_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Signup failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const normalizedEmail = sanitizeText(email, 160).toLowerCase();
      const passwordText = String(password || "");
      if (!normalizedEmail || !passwordText) {
        return res.status(400).json({ error: "Missing credentials" });
      }
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const row = await findAgencyByEmail(pool, normalizedEmail);
      if (!row) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const ok = await bcrypt.compare(passwordText, row.password_hash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const updatedRow = await saveMonthlyResetIfNeeded(pool, row);
      const agency = normalizeAgencyRow(updatedRow);
      issueAgencySession(res, agency.id);
      return res.json({ agency });
    } catch (error) {
      logger.error("login_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", authLimiter, loginLimiter, async (req, res) => {
    const genericMessage = "If an account exists for this email, a reset link has been sent.";
    try {
      if (
        cfg.PASSWORD_RESET_DELIVERY === "resend"
        && (!cfg.RESEND_API_KEY || !cfg.RESEND_FROM_EMAIL)
      ) {
        return res.status(503).json({ error: "Password reset email is not configured." });
      }

      const { email } = req.body || {};
      const normalizedEmail = sanitizeText(email, 160).toLowerCase();
      if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        return res.json({ ok: true, message: genericMessage });
      }

      const row = await findAgencyByEmail(pool, normalizedEmail);
      if (!row) {
        return res.json({ ok: true, message: genericMessage });
      }

      const { rawToken, tokenHash } = createPasswordResetToken();
      const resetUrl = buildPasswordResetUrl(cfg, rawToken);
      const expiresAt = new Date(Date.now() + cfg.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL");
        await client.query(
          "UPDATE password_resets SET used_at = NOW() WHERE agency_id = $1 AND used_at IS NULL",
          [row.id]
        );
        await client.query(
          `INSERT INTO password_resets (id, agency_id, token_hash, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), row.id, tokenHash, expiresAt.toISOString()]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      await sendPasswordResetLink({
        cfg,
        logger,
        email: normalizedEmail,
        resetUrl,
        requestId: req.requestId
      });

      const payload = { ok: true, message: genericMessage };
      if (!cfg.IS_PRODUCTION && cfg.PASSWORD_RESET_DELIVERY === "log") {
        payload.debugResetUrl = resetUrl;
        payload.debugResetToken = rawToken;
      }
      return res.json(payload);
    } catch (error) {
      logger.error("forgot_password_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Unable to process password reset request." });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, loginLimiter, async (req, res) => {
    const client = await pool.connect();
    try {
      const { token, password } = req.body || {};
      const rawToken = sanitizeText(token, 300);
      const passwordText = String(password || "");

      if (!rawToken || !passwordText) {
        return res.status(400).json({ error: "Token and password are required." });
      }
      if (passwordText.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }

      const tokenHash = sha256Text(rawToken);

      await client.query("BEGIN");
      const tokenRow = (
        await client.query(
          `SELECT id, agency_id, expires_at, used_at
           FROM password_resets
           WHERE token_hash = $1
           LIMIT 1
           FOR UPDATE`,
          [tokenHash]
        )
      ).rows[0];

      const expired = tokenRow ? new Date(tokenRow.expires_at).getTime() <= Date.now() : true;
      if (!tokenRow || tokenRow.used_at || expired) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Reset token is invalid or expired." });
      }

      const hashedPassword = await bcrypt.hash(passwordText, 12);
      await client.query("UPDATE agencies SET password_hash = $1 WHERE id = $2", [
        hashedPassword,
        tokenRow.agency_id
      ]);
      await client.query("UPDATE password_resets SET used_at = NOW() WHERE id = $1", [tokenRow.id]);
      await client.query(
        "UPDATE password_resets SET used_at = NOW() WHERE agency_id = $1 AND used_at IS NULL",
        [tokenRow.agency_id]
      );
      await client.query("COMMIT");

      clearAgencyCookie(res, cfg);
      return res.json({ ok: true, message: "Password updated. Please sign in with your new password." });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("reset_password_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Unable to reset password." });
    } finally {
      client.release();
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAgencyCookie(res, cfg);
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", authRequired, async (req, res) => {
    try {
      const row = await findAgencyById(pool, req.agencyId);
      if (!row) {
        return res.status(404).json({ error: "Agency not found" });
      }
      const updatedRow = await saveMonthlyResetIfNeeded(pool, row);
      const agency = normalizeAgencyRow(updatedRow);
      return res.json({ agency });
    } catch (error) {
      logger.error("auth_me_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to load account" });
    }
  });

  app.put("/api/agency/profile", authRequired, async (req, res) => {
    try {
      const row = await findAgencyById(pool, req.agencyId);
      if (!row) {
        return res.status(404).json({ error: "Agency not found" });
      }
      const body = req.body || {};
      const prevProfile = row.profile || {};
      const profile = {
        agencyNameAr: sanitizeText(body.agencyNameAr ?? prevProfile.agencyNameAr ?? "", 160),
        agencyTagline: sanitizeText(body.agencyTagline ?? prevProfile.agencyTagline ?? "", 180),
        agencyPhone: sanitizeText(body.agencyPhone ?? prevProfile.agencyPhone ?? "", 80),
        agencyEmail: sanitizeText(body.agencyEmail ?? prevProfile.agencyEmail ?? "", 160),
        agencyWebsite: sanitizeText(body.agencyWebsite ?? prevProfile.agencyWebsite ?? "", 180),
        agencyAddress: sanitizeText(body.agencyAddress ?? prevProfile.agencyAddress ?? "", 220),
        agencySocial1: sanitizeText(body.agencySocial1 ?? prevProfile.agencySocial1 ?? "", 180),
        agencySocial2: sanitizeText(body.agencySocial2 ?? prevProfile.agencySocial2 ?? "", 180),
        agencyLogo: sanitizeText(body.agencyLogo ?? prevProfile.agencyLogo ?? "", 400000),
        fraLogo: sanitizeText(body.fraLogo ?? prevProfile.fraLogo ?? "", 400000)
      };

      const agencyName = sanitizeText(body.agencyName || row.agency_name || "", 120);
      if (!agencyName) {
        return res.status(400).json({ error: "Agency name is required" });
      }

      await pool.query("UPDATE agencies SET agency_name = $1, profile = $2::jsonb WHERE id = $3", [
        agencyName,
        JSON.stringify(profile),
        req.agencyId
      ]);

      const updated = normalizeAgencyRow(await findAgencyById(pool, req.agencyId));
      return res.json({ ok: true, agency: updated });
    } catch (error) {
      logger.error("profile_update_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Profile update failed" });
    }
  });

  app.post("/api/subscription/payment-request", authRequired, async (req, res) => {
    try {
      const { paymentMethod, paymentReference, paymentNote } = req.body || {};
      const method = sanitizeText(paymentMethod, 80);
      const reference = sanitizeText(paymentReference, 120);
      const note = sanitizeText(paymentNote, 240);

      if (!method || !reference) {
        return res.status(400).json({ error: "Payment method and reference are required" });
      }

      const row = await findAgencyById(pool, req.agencyId);
      if (!row) {
        return res.status(404).json({ error: "Agency not found" });
      }

      const nextStatus = cfg.AUTO_APPROVE_PAYMENTS ? "active" : "pending_approval";
      await pool.query(
        "UPDATE agencies SET payment_method = $1, payment_reference = $2, payment_note = $3, subscription_status = $4 WHERE id = $5",
        [method, reference, note, nextStatus, req.agencyId]
      );
      const agency = normalizeAgencyRow(await findAgencyById(pool, req.agencyId));
      return res.json({ ok: true, agency });
    } catch (error) {
      logger.error("payment_request_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to submit payment request" });
    }
  });

  app.post("/api/cv-records", authRequired, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let row = (
        await client.query("SELECT * FROM agencies WHERE id = $1 FOR UPDATE", [req.agencyId])
      ).rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Agency not found" });
      }

      row = await saveMonthlyResetIfNeeded(client, row);
      const agency = normalizeAgencyRow(row);

      if (agency.subscriptionStatus !== "active") {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Subscription is not active." });
      }
      if (agency.cvsCreated >= agency.cvLimit) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Monthly CV limit reached" });
      }

      const body = req.body || {};
      const idempotencyKey = sanitizeText(body.idempotencyKey || randomUUID(), 120);
      const source = sanitizeText(body.source || "manual", 32) || "manual";
      const candidateName = sanitizeText(body.candidateName || "", 200);
      const referenceNo = sanitizeText(body.referenceNo || "", 120);
      const snapshotCandidate = body.snapshot && typeof body.snapshot === "object" ? body.snapshot : {};
      const snapshotRaw = JSON.stringify(snapshotCandidate);
      const snapshot = snapshotRaw.length > 250000 ? {} : snapshotCandidate;

      const inserted = await client.query(
        `INSERT INTO cv_records
          (id, agency_id, idempotency_key, source, candidate_name, reference_no, snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (agency_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [randomUUID(), agency.id, idempotencyKey, source, candidateName, referenceNo, JSON.stringify(snapshot)]
      );

      if (!inserted.rows[0]) {
        await client.query("COMMIT");
        return res.json({ ok: true, alreadyCounted: true, agency });
      }

      const updatedRow = (
        await client.query("UPDATE agencies SET cvs_created = cvs_created + 1 WHERE id = $1 RETURNING *", [
          agency.id
        ])
      ).rows[0];
      await client.query("COMMIT");
      const updated = normalizeAgencyRow(updatedRow);
      return res.status(201).json({ ok: true, alreadyCounted: false, agency: updated });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("create_cv_record_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to create CV record" });
    } finally {
      client.release();
    }
  });

  app.get("/api/cv-records", authRequired, async (req, res) => {
    try {
      const row = await findAgencyById(pool, req.agencyId);
      if (!row) {
        return res.status(404).json({ error: "Agency not found" });
      }

      const requested = Number(req.query.limit || 20);
      const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 20;
      const requestedOffset = Number(req.query.offset || 0);
      const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;

      const totalResult = await pool.query(
        "SELECT COUNT(*)::int AS count FROM cv_records WHERE agency_id = $1",
        [req.agencyId]
      );
      const total = Number(totalResult.rows[0]?.count || 0);

      const rows = (
        await pool.query(
          `SELECT id, source, candidate_name, reference_no, snapshot, created_at
           FROM cv_records
           WHERE agency_id = $1
           ORDER BY created_at DESC
           LIMIT $2
           OFFSET $3`,
          [req.agencyId, limit, offset]
        )
      ).rows;

      const records = rows.map((record) => ({
        id: record.id,
        source: record.source,
        candidateName: record.candidate_name || "-",
        referenceNo: record.reference_no || "-",
        layout: record.snapshot?.meta?.layout || "",
        createdAt: record.created_at
      }));

      return res.json({ records, total, limit, offset });
    } catch (error) {
      logger.error("load_cv_records_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to load CV history" });
    }
  });

  app.get("/api/cv-records/:id", authRequired, async (req, res) => {
    try {
      const row = (
        await pool.query(
          `SELECT id, source, candidate_name, reference_no, snapshot, created_at
           FROM cv_records
           WHERE id = $1 AND agency_id = $2
           LIMIT 1`,
          [req.params.id, req.agencyId]
        )
      ).rows[0];

      if (!row) {
        return res.status(404).json({ error: "Record not found" });
      }

      return res.json({
        record: {
          id: row.id,
          source: row.source,
          candidateName: row.candidate_name || "-",
          referenceNo: row.reference_no || "-",
          snapshot: row.snapshot || {},
          createdAt: row.created_at
        }
      });
    } catch (error) {
      logger.error("load_cv_record_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to load CV record" });
    }
  });

  app.post("/api/admin/auth/login", adminLimiter, loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const normalizedEmail = sanitizeText(email, 160).toLowerCase();
      const passwordText = String(password || "");
      if (!normalizedEmail || !passwordText) {
        return res.status(400).json({ error: "Missing credentials" });
      }
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const row = await findAdminByEmail(pool, normalizedEmail);
      if (!row || !row.is_active) {
        return res.status(401).json({ error: "Invalid admin credentials" });
      }
      if (!isAdminEmailAllowed(cfg, row.email)) {
        return res.status(403).json({ error: "Admin access is restricted." });
      }
      const ok = await bcrypt.compare(passwordText, row.password_hash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid admin credentials" });
      }

      await pool.query("UPDATE admin_users SET last_login_at = NOW() WHERE id = $1", [row.id]);
      issueAdminSession(res, row.id, row.role || "admin");
      return res.json({ admin: normalizeAdminRow(row) });
    } catch (error) {
      logger.error("admin_login_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Admin login failed" });
    }
  });

  app.get("/api/admin/auth/me", adminLimiter, adminRequired, async (req, res) => {
    try {
      const row = await findAdminById(pool, req.adminId);
      if (!row || !row.is_active) {
        return res.status(401).json({ error: "Admin account is inactive" });
      }
      return res.json({ admin: normalizeAdminRow(row) });
    } catch (error) {
      logger.error("admin_me_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Failed to load admin account" });
    }
  });

  app.post("/api/admin/auth/logout", adminLimiter, (_req, res) => {
    clearAdminCookie(res, cfg);
    return res.json({ ok: true });
  });

  app.get("/api/admin/agencies", adminLimiter, adminRequired, async (req, res) => {
    try {
      const rows = (await pool.query("SELECT * FROM agencies ORDER BY created_at DESC")).rows;
      const agencies = rows.map(normalizeAgencyRow);
      return res.json({ agencies });
    } catch (error) {
      logger.error("admin_load_agencies_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Admin load failed" });
    }
  });

  app.post("/api/admin/agencies/:id/activate", adminLimiter, adminRequired, async (req, res) => {
    try {
      const row = await findAgencyById(pool, req.params.id);
      if (!row) {
        return res.status(404).json({ error: "Agency not found" });
      }
      await pool.query("UPDATE agencies SET subscription_status = 'active' WHERE id = $1", [req.params.id]);
      const agency = normalizeAgencyRow(await findAgencyById(pool, req.params.id));
      return res.json({ ok: true, agency });
    } catch (error) {
      logger.error("admin_activate_agency_failed", { error: error.message, requestId: req.requestId });
      return res.status(500).json({ error: "Activation failed" });
    }
  });

  app.use((err, req, res, next) => {
    if (err?.message === "CORS_NOT_ALLOWED") {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    if (res.headersSent) {
      return next(err);
    }
    logger.error("unhandled_api_error", {
      requestId: req.requestId,
      error: err?.message || String(err)
    });
    return res.status(500).json({ error: "Server error" });
  });

  return app;
}

export async function startServer(options = {}) {
  const env = { ...process.env, ...(options.env || {}) };
  const cfg = createRuntimeConfig(env);
  const logger = createLogger();
  const pool = createDbPool(cfg);

  await runMigrationsUp(pool);
  await ensureBootstrapAdmin(pool, cfg, logger);

  const rateLimiterStore = createRateLimiterStore(cfg);
  const app = createApp({ cfg, pool, logger, rateLimiterStore });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(cfg.PORT, () => resolve(instance));
    instance.on("error", reject);
  });

  const actualPort = server.address()?.port || cfg.PORT;
  logger.info("api_started", {
    env: cfg.NODE_ENV,
    port: actualPort,
    rateLimitStore: cfg.RATE_LIMIT_STORE
  });

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { app, server, pool, cfg, logger, close, port: actualPort };
}

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  startServer()
    .then(({ close, logger }) => {
      const shutdown = (signal) => {
        logger.info("shutdown_requested", { signal });
        close()
          .then(() => process.exit(0))
          .catch((error) => {
            logger.error("shutdown_failed", { error: error.message });
            process.exit(1);
          });
      };
      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("SIGTERM", () => shutdown("SIGTERM"));
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "startup_failed",
          error: error.message,
          timestamp: new Date().toISOString()
        })
      );
      process.exit(1);
    });
}
