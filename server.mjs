import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchProducts, SearchError } from "./providers.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const envPath = join(root, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const provider = (process.env.PROVIDER || "gemini").toLowerCase();
const config = {
  provider,
  key: provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY,
  model: provider === "gemini" ? process.env.GEMINI_MODEL : process.env.OPENROUTER_MODEL
};
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535 || !["gemini", "openrouter"].includes(provider)) {
  console.error("Invalid PORT or PROVIDER configuration.");
  process.exit(1);
}

const staticFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "application/javascript; charset=utf-8" }
};
const requests = new Map();
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'";

function reply(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  res.end(JSON.stringify(data));
}

async function getBody(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk.toString("utf8");
    if (Buffer.byteLength(data, "utf8") > 8192) throw new SearchError("body_too_large", 413, "请求内容过长。");
  }
  try { return JSON.parse(data); }
  catch { throw new SearchError("invalid_json", 400, "请求格式无效。"); }
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === req.headers.host;
  } catch { return false; }
}

function secureKeyOrigin(req) {
  try {
    const origin = new URL(req.headers.origin || "http://" + req.headers.host);
    return origin.protocol === "https:" || ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/config") {
      return reply(res, 200, { provider: config.provider, configured: Boolean(config.key), model: config.model || null });
    }
    if (req.method === "POST" && url.pathname === "/api/search") {
      if (!sameOrigin(req)) return reply(res, 403, { error: "origin_denied", message: "请求来源不被允许。" });
      if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        return reply(res, 415, { error: "invalid_content_type", message: "请求格式无效。" });
      }
      const ip = req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const recent = (requests.get(ip) || []).filter((time) => now - time < 60_000);
      if (recent.length >= 10) return reply(res, 429, { error: "rate_limit", message: "搜索过于频繁，请稍后再试。" });
      recent.push(now);
      requests.set(ip, recent);
      const { query, settings } = await getBody(req);
      let searchConfig = config;
      if (settings !== undefined) {
        if (!secureKeyOrigin(req)) return reply(res, 403, { error: "secure_connection_required", message: "输入个人密钥需要 HTTPS 或本机连接。" });
        if (!settings || !["gemini", "openrouter"].includes(settings.provider) ||
            typeof settings.apiKey !== "string" || !settings.apiKey.trim() || settings.apiKey.length > 2048 ||
            (settings.model && (typeof settings.model !== "string" || !/^[a-zA-Z0-9_./:-]{1,120}$/.test(settings.model)))) {
          return reply(res, 400, { error: "invalid_settings", message: "请检查供应商、密钥和模型名称。" });
        }
        searchConfig = { provider: settings.provider, key: settings.apiKey.trim(), model: settings.model || undefined };
      }
      return reply(res, 200, await searchProducts({ ...searchConfig, query }));
    }
    const asset = req.method === "GET" ? staticFiles[url.pathname] : undefined;
    if (asset) {
      const data = await readFile(join(root, "public", asset.file));
      res.writeHead(200, {
        "content-type": asset.type,
        "content-security-policy": csp,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer"
      });
      return res.end(data);
    }
    return reply(res, 404, { error: "not_found" });
  } catch (error) {
    if (error instanceof SearchError) return reply(res, error.status, { error: error.code, message: error.message });
    return reply(res, 500, { error: "internal_error", message: "服务器发生错误，请稍后再试。" });
  }
});

server.listen(port, host, () => console.log("Scoutly is available at http://" + host + ":" + port));

