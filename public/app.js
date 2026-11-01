const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const button = form.querySelector("button[type=submit]");
const results = document.querySelector("#results");
const title = document.querySelector("#results-title");
const subtitle = document.querySelector("#results-subtitle");
const count = document.querySelector("#result-count");
const notice = document.querySelector("#demo-notice span");
const list = document.querySelector("#result-list");
const ribbon = document.querySelector(".demo-ribbon");
const sort = document.querySelector(".sort-select");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsForm = document.querySelector("#settings-form");
const settingsKey = document.querySelector("#settings-key");
let sessionSettings = null;
if (sort) sort.remove();
document.querySelector('label[for="sort-select"]')?.remove();

function text(tag, value, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}
function link(citation, label) {
  const a = text("a", label);
  a.href = citation.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "citation";
  a.setAttribute("aria-label", "打开来源：" + citation.title);
  return a;
}
function message(value) {
  list.replaceChildren(text("div", value, "live-message"));
}
function showResults() {
  results.classList.add("is-visible");
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderBlock(block, offset) {
  const wrapper = document.createElement("div");
  wrapper.className = "live-answer";
  const citations = block.citations.map((citation, i) => ({ ...citation, number: offset + i + 1 }))
    .filter((citation) => Number.isInteger(citation.end) && citation.end >= 0 && citation.end <= block.text.length)
    .sort((a, b) => a.end - b.end);
  let position = 0;
  for (const citation of citations) {
    if (citation.end < position) continue;
    wrapper.append(document.createTextNode(block.text.slice(position, citation.end)));
    wrapper.append(link(citation, "[" + citation.number + "]"));
    position = citation.end;
  }
  wrapper.append(document.createTextNode(block.text.slice(position)));
  list.append(wrapper);
}
function renderSources(blocks) {
  const heading = text("h3", "来源", "source-heading");
  const sources = document.createElement("div");
  sources.className = "source-list";
  let i = 0;
  for (const block of blocks) {
    for (const citation of block.citations) {
      i++;
      sources.append(link(citation, "[" + i + "] " + citation.title + " ↗"));
    }
  }
  list.append(heading, sources);
}
function renderSearchSuggestions(html) {
  if (!html) return;
  const heading = text("h3", "Google 搜索建议", "source-heading");
  const frame = document.createElement("iframe");
  frame.className = "suggestions-frame";
  frame.title = "Google 搜索建议";
  frame.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
  frame.referrerPolicy = "no-referrer";
  frame.srcdoc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src https: data:; script-src &#39;none&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">' + html;
  list.append(heading, frame);
}
async function refreshConfig() {
  if (sessionSettings) {
    ribbon.textContent = "本次会话已配置 " + (sessionSettings.provider === "gemini" ? "Gemini" : "OpenRouter");
    return;
  }
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const config = await response.json();
    ribbon.textContent = config.configured
      ? "已连接 " + (config.provider === "gemini" ? "Gemini + Google Search" : "OpenRouter Web Search")
      : "尚未配置 API 密钥 · 请查看项目 README";
  } catch {
    ribbon.textContent = "后端未连接 · 请通过 npm start 运行 Scoutly";
  }
}
async function runSearch(query) {
  if (!query) {
    input.focus();
    return;
  }
  title.textContent = "“" + query + "” 的搜索结果";
  subtitle.textContent = "正在联网查找，请稍等。";
  count.textContent = "搜索中";
  notice.textContent = "价格、库存与尺码可能变化，请打开来源核对。";
  message("正在搜索商品和商店……");
  showResults();
  button.disabled = true;
  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sessionSettings ? { query, settings: sessionSettings } : { query })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "搜索失败，请稍后重试。");
    list.replaceChildren();
    let offset = 0;
    for (const block of data.blocks) {
      renderBlock(block, offset);
      offset += block.citations.length;
    }
    renderSources(data.blocks);
    if (data.provider === "gemini") renderSearchSuggestions(data.searchSuggestions);
    subtitle.textContent = "AI 已搜索网络；请通过来源链接核对商品详情。";
    count.textContent = offset + " 个来源";
  } catch (error) {
    subtitle.textContent = "这次未能完成联网搜索。";
    count.textContent = "未完成";
    message(error.message || "搜索失败，请检查配置。");
  } finally {
    button.disabled = false;
  }
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch(input.value.trim());
});
document.querySelectorAll("[data-query]").forEach((item) => {
  item.addEventListener("click", () => {
    input.value = item.dataset.query;
    input.focus();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});
const categoryQueries = { Fashion: "运动鞋", Electronics: "无线耳机", Home: "空气炸锅", Health: "维生素", Sports: "跑鞋", Beauty: "防晒霜" };
document.querySelectorAll("[data-category]").forEach((item) => {
  item.addEventListener("click", () => {
    input.value = categoryQueries[item.dataset.category] || item.dataset.category;
    input.focus();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});
document.querySelector("#nav-results").addEventListener("click", (event) => {
  if (!results.classList.contains("is-visible")) {
    event.preventDefault();
    input.focus();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
document.querySelector("#browse-link").addEventListener("click", () => input.focus());
document.querySelector("#settings-open").addEventListener("click", () => settingsDialog.showModal());
document.querySelector("#settings-close").addEventListener("click", () => settingsDialog.close());
document.querySelector("#settings-clear").addEventListener("click", () => {
  sessionSettings = null;
  settingsForm.reset();
  settingsDialog.close();
  refreshConfig();
});
settingsDialog.addEventListener("close", () => { settingsKey.value = ""; });
settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!window.isSecureContext) {
    settingsKey.setCustomValidity("请输入密钥前，请使用 HTTPS 或本机 localhost。");
    settingsKey.reportValidity();
    settingsKey.setCustomValidity("");
    return;
  }
  const apiKey = settingsKey.value.trim();
  if (!apiKey) return;
  sessionSettings = {
    provider: document.querySelector("#settings-provider").value,
    apiKey,
    model: document.querySelector("#settings-model").value.trim()
  };
  settingsDialog.close();
  refreshConfig();
});
refreshConfig();

