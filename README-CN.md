<div align="center">
<img src="public/icon-128.png" alt="WebClaw" width="96"/>
<h1>WebClaw</h1>
<p><strong>浏览网页时，通过 Chrome 侧栏连接 OpenClaw 网关，完成对话、页面理解与快捷指令。</strong></p>
<p><em>Chrome 扩展 · Manifest V3 · React + Vite + TypeScript + Tailwind CSS 4</em></p>
<p>English readme: <a href="./README.md">README.md</a></p>
</div>

---

## 简介

**WebClaw** 是一款浏览器扩展：在任意网页上提取标题、正文（Readability + Markdown）、选区与整页文本，通过 **OpenAI 兼容的 `/v1/chat/completions` 接口** 将用户消息（可附带页面上下文）发送到本机或远程的 **OpenClaw 网关**，并以流式或非流式方式展示回复。

扩展不负责运行大模型本身；你需要自行部署并运行兼容的网关服务（默认期望地址为 `http://localhost:18789`），并在选项页填写 **Token** 与可选的 **Session Key**。

## 功能概览

| 能力 | 说明 |
|------|------|
| **侧栏聊天** | 点击工具栏图标打开 Side Panel，针对当前标签页同步页面上下文，支持多轮对话与流式输出。 |
| **内容脚本（页面提取）** | 在页面文档内提取标题、正文（Readability + Markdown）、整页文本，并把选区同步到侧栏。 |
| **右键菜单** | 可配置的「整页」与「选中文本」类提示词；支持 `{url}`、`{text}` 占位符；可打开侧栏并自动填入/发送。 |
| **页面上下文模式** | 正文（Readability 文章）、整页纯文本、当前选区；上下文长度上限约 16k 字符，超出会截断并标注。 |
| **选项页** | 网关地址、Token、Session Key、界面语言（简体中文 / English）、多组快捷提示词。 |

## 系统要求与权限

- **Node.js**：建议 ≥ 18（与 CI 一致）。
- **Chrome**：需支持 Side Panel API，以获得完整侧栏体验。
- **manifest 权限**：`storage`、`contextMenus`、`activeTab`、`sidePanel`（Chrome）、`scripting`、`tabs`，以及 `<all_urls>` 的 `host_permissions`，用于内容脚本与页面提取。

## 快速开始

### 从 GitHub Release 安装（Chrome）

1. 打开本仓库的 **[Releases](https://github.com/xue160709/WebClaw/releases)** 页面，下载最新发行版中的扩展压缩包（常见为 `.zip`）。
2. 解压后，在「加载已解压的扩展程序」时选择**根目录下含有 `manifest.json` 的文件夹**（发行包一般为已构建好的 `dist_chrome` 目录结构）。
3. 在 Chrome 中打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选中该文件夹。

若使用预构建包，可跳过下文 **§1～§3**，直接从 **OpenClaw 网关** 与 **4. 配置网关** 继续。

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

### 3. 加载扩展

**Chrome**

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择项目下的 **`dist_chrome`**（开发或构建后生成）

### OpenClaw 网关：开启 Chat Completions（HTTP）

WebClaw 依赖 OpenClaw 网关提供的 **OpenAI 兼容** `POST /v1/chat/completions` 接口。该 HTTP 端点**默认关闭**，请在 OpenClaw 的配置文件 **`openclaw.json`** 中加入或合并以下配置，并**重启网关**后生效：

```json5
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
}
```

鉴权方式、`model` 与 Agent 路由、流式（SSE）以及该接口的安全边界等，详见官方文档：[OpenAI Chat Completions（HTTP）](https://docs.openclaw.ai/gateway/openai-http-api)。

### 4. 配置网关

1. 点击扩展图标打开 Popup，或使用选项页入口打开 **设置**。
2. 填写 **OpenClaw Token**（必填）、**网关地址**（默认 `http://localhost:18789`，扩展会自动补全为 `.../v1/chat/completions`）、**Session Key**（默认 `agent:main:main`，可按网关要求调整）。
3. 保存后即可在侧栏中发起对话。

## 使用说明

- **工具栏图标**：与 **侧栏** 联动（由后台 `sidePanel.setPanelBehavior` 配置）。
- **右键菜单**：根菜单标题与子项随语言与存储的提示词列表更新；选「整页」类项会带入当前标签 URL，选「选区」类项会替换 `{text}`。
- **聊天记录**：按规范化后的页面 URL 与会话维度存储在 `chrome.storage.local`（见 `panelChatStore`），便于同页多轮对话。

生产构建产物目录为 **`dist_chrome`**（`npm run build` 与 `npm run build:chrome` 相同）。

## 项目结构（摘）

```
src/
  lib/openclaw/          # 网关请求、页面提取、上下文拼接、i18n、聊天持久化
  pages/
    background/          # Service worker：菜单、侧栏行为、消息中转、流式转发
    content/             # 内容脚本：页面提取与选区桥接
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

欢迎通过 Issue / Pull Request 反馈问题或提交改进。若修改 manifest 或权限，请在说明中写清对侧栏与内容脚本行为的影响。
