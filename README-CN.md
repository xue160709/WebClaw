<div align="center">
<img src="public/icon-128.png" alt="OpenClaw Web Assistant" width="96"/>
<h1>OpenClaw Web Assistant</h1>
<p><strong>浏览网页时，通过侧栏与浮动助手连接 OpenClaw 网关，完成对话、页面理解与快捷指令。</strong></p>
<p><em>Chrome / Firefox 扩展 · Manifest V3 · React + Vite + TypeScript + Tailwind CSS 4</em></p>
<p>English readme: <a href="./README.md">README.md</a></p>
</div>

---

## 简介

**OpenClaw Web Assistant** 是一款浏览器扩展：在任意网页上提取标题、正文（Readability + Markdown）、选区与整页文本，通过 **OpenAI 兼容的 `/v1/chat/completions` 接口** 将用户消息（可附带页面上下文）发送到本机或远程的 **OpenClaw 网关**，并以流式或非流式方式展示回复。

扩展不负责运行大模型本身；你需要自行部署并运行兼容的网关服务（默认期望地址为 `http://localhost:18789`），并在选项页填写 **Token** 与可选的 **Session Key**。

## 功能概览

| 能力 | 说明 |
|------|------|
| **侧栏聊天（Chrome）** | 点击工具栏图标打开 Side Panel，针对当前标签页同步页面上下文，支持多轮对话与流式输出。 |
| **页面内浮动助手** | 内容脚本注入可拖拽图标与对话窗，悬停快捷菜单、全屏模式、按页面 URL 持久化聊天记录。 |
| **右键菜单** | 可配置的「整页」与「选中文本」类提示词；支持 `{url}`、`{text}` 占位符；在 Chrome 上可打开侧栏并自动填入/发送。 |
| **页面上下文模式** | 正文（Readability 文章）、整页纯文本、当前选区；上下文长度上限约 16k 字符，超出会截断并标注。 |
| **选项页** | 网关地址、Token、Session Key、界面语言（简体中文 / English）、多组快捷提示词。 |
| **Firefox** | 构建时移除 `sidePanel`，以浮动助手与右键注入为主（见下文）。 |

## 系统要求与权限

- **Node.js**：建议 ≥ 18（与 CI 一致）。
- **Chrome**：需支持 Side Panel API，以获得完整侧栏体验。
- **manifest 权限**：`storage`、`contextMenus`、`activeTab`、`sidePanel`（Chrome）、`scripting`、`tabs`，以及 `<all_urls>` 的 `host_permissions`，用于内容脚本与页面提取。

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或
yarn
```

### 2. 开发构建（监听文件变更）

默认目标为 **Chrome**：

```bash
npm run dev
# 或
yarn dev
```

Firefox：

```bash
npm run dev:firefox
# 或
yarn dev:firefox
```

### 3. 加载扩展

**Chrome**

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择项目下的 **`dist_chrome`**（开发或构建后生成）

**Firefox**

1. 打开 `about:debugging#/runtime/this-firefox`
2. 「临时载入附加组件」→ 选择 **`dist_firefox`** 中的 `manifest.json`

### 4. 配置网关

1. 点击扩展图标打开 Popup，或使用选项页入口打开 **设置**。
2. 填写 **OpenClaw Token**（必填）、**网关地址**（默认 `http://localhost:18789`，扩展会自动补全为 `.../v1/chat/completions`）、**Session Key**（默认 `agent:main:main`，可按网关要求调整）。
3. 保存后即可在侧栏或浮动助手中发起对话。

## 使用说明

- **工具栏图标**：在 Chrome 上通常与 **侧栏** 联动（由后台 `sidePanel.setPanelBehavior` 配置）。
- **浮动助手**：页面右侧（或可拖拽）图标；支持悬停显示基于选项页配置的快捷提示、打开对话、选择上下文模式后发送。
- **右键菜单**：根菜单标题与子项随语言与存储的提示词列表更新；选「整页」类项会带入当前标签 URL，选「选区」类项会替换 `{text}`。
- **聊天记录**：按规范化后的页面 URL 与会话维度存储在 `chrome.storage.local`（见 `panelChatStore`），便于同页多轮对话。

## Chrome 与 Firefox 的差异

| 项目 | Chrome | Firefox |
|------|--------|---------|
| 侧栏 | 有 | 无（manifest 中移除 `side_panel`） |
| 右键打开侧栏并自动发送 | 支持 | 回退为向内容脚本注入文本并自动发送 |
| 输出目录 | `dist_chrome` | `dist_firefox` |

构建命令：`npm run build:chrome` / `npm run build:firefox`（`yarn` 同理）。

## 项目结构（摘）

```
src/
  lib/openclaw/          # 网关请求、页面提取、上下文拼接、i18n、聊天持久化
  pages/
    background/          # Service worker：菜单、侧栏行为、消息中转、流式转发
    content/             # 浮动助手与页面内提取
    panel/               # 侧栏 UI
    options/             # 设置页
    popup/               # 工具栏弹窗
```

核心逻辑简述：

- **`gateway.ts`**：组装 `Authorization: Bearer <token>`、可选 `x-openclaw-session-key`，请求体为 `model: "openclaw"` 的 chat completions；解析 SSE 或 JSON 回复。
- **`extractPageInPage.ts`**：在页面文档内使用 `@mozilla/readability` 与 `turndown` 生成正文 Markdown，并保留 `body.innerText` 作为整页文本来源。

## 生产构建与 CI

```bash
npm run build          # 同 build:chrome
npm run build:chrome
npm run build:firefox
```

GitHub Actions（手动触发）：`.github/workflows/ci.yml` 使用 Node 18、`yarn install` 与 `yarn build:chrome`，产物上传为 Artifact（名称仍为 `vite-web-extension-chrome`，与历史模板一致）。

## 技术栈

- React 19、TypeScript、Vite 6、Tailwind CSS 4  
- `@crxjs/vite-plugin`（CRX 构建）  
- `webextension-polyfill`（跨浏览器 API）  
- `@mozilla/readability`、`turndown`（页面正文提取与 Markdown）

## 许可证

[MIT](LICENSE)

## 贡献

欢迎通过 Issue / Pull Request 反馈问题或提交改进。若修改 manifest、权限或构建目标，请在说明中写清对 Chrome / Firefox 行为的影响。
