# Scoutly

Scoutly 是一个商品价格搜索原型。输入商品名称后，后端调用 Gemini + Google Search 或 OpenRouter Web Search，页面展示 AI 的结果和来源链接。

> 搜索覆盖范围取决于供应商和可访问的网页。结果可能过时、缺少尺码或误匹配；购买前请打开来源核对。Scoutly 不处理付款。

## 快速开始

需要 Node.js 22 或更高版本，以及支持联网搜索的 Gemini 或 OpenRouter API 密钥。使用该功能可能产生供应商费用。

1. 下载或克隆本仓库。
2. 执行 `npm start`，打开终端显示的本地地址。
3. 点击网页右上角的 **配置 API**，选择 Gemini 或 OpenRouter，输入自己的密钥，再搜索商品。密钥只保存在当前页面的内存中，刷新或关闭页面后会清除；每次搜索会将它发送给当前网站的后端处理。

也可以为自己的部署配置默认密钥：

1. 在项目根目录复制 .env.example 为 .env。
   - Windows PowerShell：`Copy-Item .env.example .env`
   - macOS / Linux：`cp .env.example .env`
2. 编辑 .env，选择一个供应商并填写对应的密钥：
   - Gemini：设置 `PROVIDER=gemini` 和 `GEMINI_API_KEY`。
   - OpenRouter：设置 `PROVIDER=openrouter` 和 `OPENROUTER_API_KEY`。
3. 重新启动 `npm start`。

默认使用 Gemini 3.8 Flash 或 OpenRouter 的 google/gemini-3.8-flash。可在 .env 中修改模型名称；请确认模型和账号支持联网搜索。修改 .env 后重启服务。

.env 已被 .gitignore 忽略。服务器默认密钥只由后端读取。使用页面内配置时，个人密钥在浏览器内存中暂存，并发送给网站后端；不要在不信任的部署上输入密钥。程序不将页面输入的密钥写入文件，也不使用浏览器持久存储。

## 搜索如何工作

- Gemini 使用 Interactions API 的 google_search 工具。
- OpenRouter 使用 openrouter:web_search 服务器工具。
- 后端只返回带有供应商来源注释的结果，网页显示可点击的来源。
- Gemini 返回的 Google 搜索建议会在隔离的框架中显示。
- 搜索引擎可能找不到某些商城、变体、尺码或最新价格。AI 内容和价格并非独立验证。

供应商对联网搜索、模型、额度和费用有不同要求：
- Gemini 搜索：https://ai.google.dev/gemini-api/docs/google-search
- Gemini 定价：https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter 搜索：https://openrouter.ai/docs/guides/features/server-tools/web-search
- OpenRouter 定价：https://openrouter.ai/tool/web-search/

## 部署

服务器默认监听 127.0.0.1，只供本机访问。它包含基础请求频率限制，但没有账户系统或完整的公网防护。公开部署前应加上身份验证、访问控制、可靠的服务端限流和费用控制，并通过部署平台的服务端密钥管理设置环境变量。不要把密钥放在 HTML、前端代码、GitHub 或聊天中。

当前 GitHub 项目中的 Node.js 服务与原来的静态 Sites 演示是两个运行环境。要让原来的在线演示也支持 live search，需要部署一个可用的后端并安全配置其供应商密钥。

## 验证

运行 `npm test` 检查 Gemini / OpenRouter 的请求格式、来源处理、密钥会话和错误处理。这些测试使用模拟响应，不会访问供应商或产生费用。要验证真实联网搜索，需要配置支持搜索的有效密钥和可用额度，再通过网页搜索实际商品。

## 许可证

MIT。详见 LICENSE。

