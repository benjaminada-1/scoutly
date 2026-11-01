import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

test("local server accepts per-session keys without storing or exposing them", { timeout: 15_000 }, async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const port = 38000 + Math.floor(Math.random() * 10000);
  const base = "http://127.0.0.1:" + port;
  const child = spawn(process.execPath, ["--import", "./test/mock-provider.mjs", "server.mjs"], {
    cwd: root,
    env: { ...process.env, PROVIDER: "gemini", GEMINI_API_KEY: "", OPENROUTER_API_KEY: "", PORT: String(port), HOST: "127.0.0.1", NODE_OPTIONS: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  try {
    for (let i = 0; i < 60 && !output.includes("Scoutly is available"); i++) {
      if (child.exitCode !== null) throw new Error("Server exited before startup");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    assert.match(output, /Scoutly is available/);
    const config = await (await fetch(base + "/api/config")).json();
    assert.equal(config.configured, false);
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    const post = (settings, origin = base) => fetch(base + "/api/search", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ query: "Adidas Samba", ...(settings ? { settings } : {}) })
    });
    const withoutKey = await post(null);
    assert.equal(withoutKey.status, 503);
    const gemini = await post({ provider: "gemini", apiKey: "sample-gemini-key", model: "" });
    assert.equal(gemini.status, 200);
    const data = await gemini.json();
    assert.equal(data.blocks[0].citations[0].url, "https://shop.example/samba");
    assert.equal(JSON.stringify(data).includes("sample-gemini-key"), false);
    const router = await post({ provider: "openrouter", apiKey: "sample-router-key", model: "" });
    assert.equal(router.status, 200);
    const denied = await post({ provider: "gemini", apiKey: "sample-gemini-key" }, "https://untrusted.example");
    assert.equal(denied.status, 403);
    const after = await (await fetch(base + "/api/config")).json();
    assert.equal(after.configured, false);
    assert.equal((await fetch(base + "/.env")).status, 404);
  } finally {
    child.kill();
    if (child.exitCode === null) await Promise.race([once(child, "exit"), new Promise((r) => setTimeout(r, 2000))]);
  }
});

