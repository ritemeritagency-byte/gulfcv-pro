import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.js";

const TEST_DATABASE_URL = String(process.env.TEST_DATABASE_URL || "");
const SHOULD_RUN = Boolean(TEST_DATABASE_URL);

function createCookieJar() {
  const jar = new Map();
  return {
    toHeader() {
      return Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    absorb(response) {
      const raw = response.headers.get("set-cookie");
      if (!raw) return;
      const cookiePairs = raw.split(/,(?=\s*[^;,\s]+=)/g);
      for (const cookie of cookiePairs) {
        const firstPart = String(cookie || "").split(";")[0] || "";
        const separator = firstPart.indexOf("=");
        if (separator < 1) continue;
        const name = firstPart.slice(0, separator).trim();
        const value = firstPart.slice(separator + 1).trim();
        if (!name) continue;
        if (!value) {
          jar.delete(name);
        } else {
          jar.set(name, value);
        }
      }
    }
  };
}

async function apiRequest(baseUrl, jar, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const cookieHeader = jar.toHeader();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  jar.absorb(response);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

if (!SHOULD_RUN) {
  test("integration suite skipped", { skip: "Set TEST_DATABASE_URL to run integration tests." }, () => {});
} else {
  test("auth, usage limits, and admin activation flow", async (t) => {
    const bootstrapEmail = "admin.integration@example.com";
    const bootstrapPassword = "Admin-Integration-Password-123!";
    const runtime = await startServer({
      env: {
        NODE_ENV: "test",
        PORT: "0",
        DATABASE_URL: TEST_DATABASE_URL,
        DATABASE_SSL: "false",
        JWT_SECRET: "integration-jwt-secret-abcdefghijklmnopqrstuvwxyz",
        ADMIN_JWT_SECRET: "integration-admin-jwt-secret-abcdefghijklmnopqrstuvwxyz",
        CORS_ORIGINS: "http://localhost:5500",
        RATE_LIMIT_STORE: "memory",
        PASSWORD_RESET_DELIVERY: "log",
        PASSWORD_RESET_URL_BASE: "http://localhost:5500",
        ADMIN_BOOTSTRAP_EMAIL: bootstrapEmail,
        ADMIN_BOOTSTRAP_PASSWORD: bootstrapPassword
      }
    });

    t.after(async () => {
      await runtime.close();
    });

    await runtime.pool.query("TRUNCATE TABLE password_resets, cv_records, agencies RESTART IDENTITY CASCADE");
    await runtime.pool.query("DELETE FROM admin_users WHERE email <> $1", [bootstrapEmail]);
    await runtime.pool.query("DELETE FROM api_rate_limits");

    const baseUrl = `http://127.0.0.1:${runtime.port}/api`;

    const agencyJar = createCookieJar();
    const adminJar = createCookieJar();

    const signup = await apiRequest(baseUrl, agencyJar, "/auth/signup", {
      method: "POST",
      body: {
        agencyName: "Integration Agency",
        email: "agency.integration@example.com",
        password: "StrongPassword-123",
        plan: "free"
      }
    });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.data.agency.agencyName, "Integration Agency");

    const me = await apiRequest(baseUrl, agencyJar, "/auth/me");
    assert.equal(me.response.status, 200);
    assert.equal(me.data.agency.email, "agency.integration@example.com");

    const forgot = await apiRequest(baseUrl, createCookieJar(), "/auth/forgot-password", {
      method: "POST",
      body: { email: "agency.integration@example.com" }
    });
    assert.equal(forgot.response.status, 200);
    assert.equal(forgot.data.ok, true);
    assert.ok(forgot.data.debugResetToken);

    const reset = await apiRequest(baseUrl, createCookieJar(), "/auth/reset-password", {
      method: "POST",
      body: {
        token: forgot.data.debugResetToken,
        password: "StrongPassword-456"
      }
    });
    assert.equal(reset.response.status, 200);
    assert.equal(reset.data.ok, true);

    const loginWithNewPassword = await apiRequest(baseUrl, createCookieJar(), "/auth/login", {
      method: "POST",
      body: {
        email: "agency.integration@example.com",
        password: "StrongPassword-456"
      }
    });
    assert.equal(loginWithNewPassword.response.status, 200);

    const firstRecord = await apiRequest(baseUrl, agencyJar, "/cv-records", {
      method: "POST",
      body: {
        idempotencyKey: "idempotency-a",
        candidateName: "Candidate One",
        referenceNo: "REF-001",
        source: "manual",
        snapshot: { meta: { layout: "standard" } }
      }
    });
    assert.equal(firstRecord.response.status, 201);
    assert.equal(firstRecord.data.alreadyCounted, false);

    const duplicateRecord = await apiRequest(baseUrl, agencyJar, "/cv-records", {
      method: "POST",
      body: {
        idempotencyKey: "idempotency-a",
        candidateName: "Candidate One",
        referenceNo: "REF-001",
        source: "manual",
        snapshot: { meta: { layout: "standard" } }
      }
    });
    assert.equal(duplicateRecord.response.status, 200);
    assert.equal(duplicateRecord.data.alreadyCounted, true);

    await runtime.pool.query("UPDATE agencies SET subscription_status = 'pending_approval' WHERE id = $1", [
      signup.data.agency.id
    ]);

    const blockedRecord = await apiRequest(baseUrl, agencyJar, "/cv-records", {
      method: "POST",
      body: {
        idempotencyKey: "idempotency-b",
        candidateName: "Candidate Two",
        referenceNo: "REF-002",
        source: "manual",
        snapshot: {}
      }
    });
    assert.equal(blockedRecord.response.status, 403);
    assert.match(String(blockedRecord.data.error || ""), /Subscription is not active/i);

    const adminLogin = await apiRequest(baseUrl, adminJar, "/admin/auth/login", {
      method: "POST",
      body: { email: bootstrapEmail, password: bootstrapPassword }
    });
    assert.equal(adminLogin.response.status, 200);
    assert.equal(adminLogin.data.admin.email, bootstrapEmail);

    const agenciesList = await apiRequest(baseUrl, adminJar, "/admin/agencies");
    assert.equal(agenciesList.response.status, 200);
    assert.ok(Array.isArray(agenciesList.data.agencies));
    assert.ok(agenciesList.data.agencies.some((agency) => agency.id === signup.data.agency.id));

    const activate = await apiRequest(
      baseUrl,
      adminJar,
      `/admin/agencies/${encodeURIComponent(signup.data.agency.id)}/activate`,
      { method: "POST" }
    );
    assert.equal(activate.response.status, 200);
    assert.equal(activate.data.agency.subscriptionStatus, "active");

    const health = await apiRequest(baseUrl, agencyJar, "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.data.ok, true);
    assert.equal(health.data.db.ok, true);
  });
}
