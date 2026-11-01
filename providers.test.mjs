import test from "node:test";
import assert from "node:assert/strict";
import { searchProducts, SearchError } from "./providers.mjs";

function fakeFetch(body, status = 200) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }
  };
}

test("Gemini search enables grounding and returns only safe cited sources", async () => {
  const mocked = fakeFetch({
    steps: [
      { type: "google_search_result", result: [{ search_suggestions: "<div>Google</div>" }] },
      { type: "model_output", content: [{
        type: "text", text: "Shoes RM 490",
        annotations: [
          { type: "url_citation", url: "https://example.com/item", title: "Example shop", start_index: 0, end_index: 12 },
          { type: "url_citation", url: "javascript:alert(1)", title: "Bad", end_index: 10 }
        ]
      }] }
    ]
  });
  const result = await searchProducts({ provider: "gemini", key: "test-key", query: "samba", fetchFn: mocked.fetch });
  const sent = JSON.parse(mocked.calls[0].options.body);
  assert.deepEqual(sent.tools, [{ type: "google_search" }]);
  assert.equal(mocked.calls[0].options.headers["x-goog-api-key"], "test-key");
  assert.equal(result.blocks[0].citations.length, 1);
  assert.equal(result.blocks[0].citations[0].url, "https://example.com/item");
  assert.equal(result.searchSuggestions, "<div>Google</div>");
});

test("OpenRouter enables server web search and preserves source citations", async () => {
  const mocked = fakeFetch({
    choices: [{ message: { content: "Offer RM 100", annotations: [
      { type: "url_citation", url_citation: { url: "https://shop.example/item", title: "Shop", start_index: 0, end_index: 12 } }
    ] } }]
  });
  const result = await searchProducts({ provider: "openrouter", key: "test-key", query: "headphones", fetchFn: mocked.fetch });
  const sent = JSON.parse(mocked.calls[0].options.body);
  assert.equal(sent.tools[0].type, "openrouter:web_search");
  assert.equal(result.blocks[0].citations[0].title, "Shop");
});

test("missing key and unsupported provider fail clearly", async () => {
  await assert.rejects(searchProducts({ provider: "gemini", key: "", query: "test" }), (error) => error instanceof SearchError && error.code === "not_configured");
  await assert.rejects(searchProducts({ provider: "unknown", key: "x", query: "test" }), (error) => error instanceof SearchError && error.code === "invalid_provider");
});

test("answers without citations are rejected rather than presented as live results", async () => {
  const mocked = fakeFetch({ choices: [{ message: { content: "It costs RM 10", annotations: [] } }] });
  await assert.rejects(searchProducts({ provider: "openrouter", key: "test", query: "item", fetchFn: mocked.fetch }), (error) => error instanceof SearchError && error.code === "no_grounded_results");
});

test("provider errors do not expose response bodies or API keys", async () => {
  const mocked = fakeFetch({ error: { message: "test-secret" } }, 401);
  await assert.rejects(searchProducts({ provider: "gemini", key: "test-secret", query: "item", fetchFn: mocked.fetch }), (error) => error.code === "invalid_credentials" && !error.message.includes("test-secret"));
});

