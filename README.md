<div align="center">
<img src="public/icon-128.png" alt="WebClaw" width="96"/>
<h1>WebClaw</h1>
<p><strong>Connect to your OpenClaw gateway from the Chrome side panel while you browse—chat, page understanding, and quick prompts.</strong></p>
<p><em>Chrome extension · Manifest V3 · React + Vite + TypeScript + Tailwind CSS 4</em></p>
<p>简体中文说明见 <a href="./README-CN.md">README-CN.md</a></p>
</div>

---

## Overview

**WebClaw** is a browser extension that extracts the page title, main article text (Readability + Markdown), selection, and full-page plain text, then sends your messages (optionally with page context) to a local or remote **OpenClaw gateway** through an **OpenAI-compatible `/v1/chat/completions` endpoint**, displaying responses in streaming or non-streaming mode.

The extension does **not** run the model itself. You need a compatible gateway (default base URL: `http://localhost:18789`) and must set your **Token** and optional **Session Key** on the options page.

## Features

| Feature | Description |
|--------|-------------|
| **Side panel chat** | Toolbar icon opens the Side Panel; syncs context for the active tab; multi-turn chat and streaming. |
| **Content script (page extract)** | Runs in the page to extract title, article (Readability + Markdown), full-page text, and sync selection to the panel. |
| **Context menu** | Configurable page-level and selection-level prompts; `{url}` and `{text}` placeholders; can open the side panel and fill/auto-send. |
| **Page context modes** | Article (Readability), full-page text, or current selection; context capped around 16k characters with truncation notice. |
| **Options** | Gateway URL, token, session key, UI language (简体中文 / English), multiple quick prompts. |

## Requirements & permissions

- **Node.js**: 18+ recommended (matches CI).
- **Chrome**: Side Panel API recommended for the full side-panel experience.
- **Manifest**: `storage`, `contextMenus`, `activeTab`, `sidePanel` (Chrome), `scripting`, `tabs`, and `<all_urls>` `host_permissions` for the content script and page extraction.

## Quick start

### Install from GitHub Release (Chrome)

1. Open **[Releases](https://github.com/xue160709/WebClaw/releases)** and download the latest extension archive (for example a `.zip` from the release assets).
2. Unzip it. In **Load unpacked**, pick the folder whose **root contains `manifest.json`** (release packages are usually the built `dist_chrome` layout).
3. In Chrome, go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select that folder.

If you use a prebuilt release, skip **§1–§3** below and continue with **OpenClaw gateway** and **Configure the gateway**.

### 1. Install dependencies

```bash
npm install
# or
yarn
```

### 2. Dev build (watch mode)

Default target is **Chrome**:

```bash
npm run dev
# or
yarn dev
```

### 3. Load the extension

**Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the **`dist_chrome`** folder (created after dev or build)

### OpenClaw gateway: enable Chat Completions (HTTP)

WebClaw uses the Gateway’s **OpenAI-compatible** `POST /v1/chat/completions` endpoint. That HTTP surface is **disabled by default**; enable it in your OpenClaw config file **`openclaw.json`** (merge or add the following, then restart the Gateway):

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

For authentication, agent-first `model` routing, streaming (SSE), and the security boundary for this endpoint, see the official docs: [OpenAI Chat Completions (HTTP)](https://docs.openclaw.ai/gateway/openai-http-api).

### 4. Configure the gateway

1. Open the popup from the toolbar or open **Options** from the extension menu.
2. Set **OpenClaw Token** (required), **gateway URL** (default `http://localhost:18789`; the extension normalizes to `.../v1/chat/completions`), and **Session Key** (default `agent:main:main`, adjust per your gateway).
3. Save, then chat from the side panel.

## Usage

- **Toolbar icon**: Opens the **side panel** via `sidePanel.setPanelBehavior` in the background worker.
- **Context menu**: Root title and items follow locale and stored prompt lists; page items substitute the tab URL; selection items substitute `{text}`.
- **Chat history**: Stored in `chrome.storage.local` keyed by normalized page URL and session (see `panelChatStore`) for multi-turn threads per page.

Production builds output to **`dist_chrome`** (`npm run build` is the same as `npm run build:chrome`).

## Project layout (excerpt)

```
src/
  lib/openclaw/          # Gateway client, page extract, context compose, i18n, chat persistence
  pages/
    background/          # Service worker: menus, side panel, messaging, stream relay
    content/             # Content script: page extract + selection bridge
    panel/               # Side panel UI
    options/             # Settings
    popup/               # Toolbar popup
```

Core pieces:

- **`gateway.ts`**: Builds `Authorization: Bearer <token>`, optional `x-openclaw-session-key`, `model: "openclaw"` chat completions body; parses SSE or JSON.
- **`extractPageInPage.ts`**: Runs in the page document with `@mozilla/readability` and `turndown` for article Markdown; uses `body.innerText` for full-page text.

## Production build & CI

```bash
npm run build          # same as build:chrome
npm run build:chrome
```

GitHub Actions (manual): `.github/workflows/ci.yml` uses Node 18, `yarn install`, and `yarn build:chrome`; uploads artifact `vite-web-extension-chrome` (legacy name from the template).

## Tech stack

- React 19, TypeScript, Vite 6, Tailwind CSS 4  
- `@crxjs/vite-plugin`  
- `webextension-polyfill`  
- `@mozilla/readability`, `turndown`

## License

[MIT](LICENSE)

## Contributing

Issues and pull requests are welcome. If you change the manifest or permissions, please note the impact on the side panel and content script behavior.
