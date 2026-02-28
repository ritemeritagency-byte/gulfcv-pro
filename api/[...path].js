const DEFAULT_BACKEND_API_BASE = "https://gulfcv-pro-production.up.railway.app/api";

export const config = {
  api: {
    bodyParser: false
  }
};

function normalizeApiBase(value) {
  return String(value || DEFAULT_BACKEND_API_BASE).trim().replace(/\/+$/, "");
}

function getPathSegments(queryPath) {
  if (Array.isArray(queryPath)) return queryPath.filter(Boolean);
  if (typeof queryPath === "string" && queryPath) return [queryPath];
  return [];
}

function buildTargetUrl(req) {
  const base = normalizeApiBase(process.env.BACKEND_API_BASE);
  const url = new URL(base);
  const segments = getPathSegments(req.query?.path);
  if (segments.length > 0) {
    url.pathname = `${url.pathname}/${segments.join("/")}`.replace(/\/{2,}/g, "/");
  }

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function toRequestHeaders(req) {
  const blocked = new Set([
    "host",
    "connection",
    "content-length",
    "origin",
    "referer",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
    "x-vercel-id"
  ]);

  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    const lower = key.toLowerCase();
    if (blocked.has(lower)) continue;
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return headers;
}

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

function copyResponseHeaders(res, upstream) {
  const blocked = new Set(["content-length", "transfer-encoding", "connection", "content-encoding"]);

  upstream.headers.forEach((value, key) => {
    if (blocked.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });

  if (typeof upstream.headers.getSetCookie === "function") {
    const setCookies = upstream.headers.getSetCookie();
    if (setCookies && setCookies.length > 0) {
      res.setHeader("set-cookie", setCookies);
    }
  }
}

export default async function handler(req, res) {
  try {
    const targetUrl = buildTargetUrl(req);
    const body = await readBody(req);
    const headers = toRequestHeaders(req);

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });

    copyResponseHeaders(res, upstream);
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(payload);
  } catch (error) {
    res.status(502).json({ error: "Upstream API unavailable", detail: error?.message || "Unknown error" });
  }
}
