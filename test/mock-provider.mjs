const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
    if (options.headers["x-goog-api-key"] !== "sample-gemini-key") return new Response("bad", { status: 401 });
    return Response.json({ steps: [{ type: "model_output", content: [{
      type: "text", text: "Samba RM 123",
      annotations: [{ type: "url_citation", url: "https://shop.example/samba", title: "Shop", start_index: 0, end_index: 12 }]
    }] }] });
  }
  if (String(url).startsWith("https://openrouter.ai/")) {
    if (options.headers.authorization !== "Bearer sample-router-key") return new Response("bad", { status: 401 });
    return Response.json({ choices: [{ message: { content: "Samba RM 123", annotations: [
      { type: "url_citation", url_citation: { url: "https://shop.example/samba", title: "Shop", start_index: 0, end_index: 12 } }
    ] } }] });
  }
  return originalFetch(url, options);
};

