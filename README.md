<div align="center">
<img src="public/icon-128.png" alt="OpenClaw Web Assistant" width="96"/>
<h1>OpenClaw Web Assistant</h1>
<p><strong>Connect to your OpenClaw gateway from the side panel and an in-page assistant while you browse—chat, page understanding, and quick prompts.</strong></p>
<p><em>Chrome / Firefox extension · Manifest V3 · React + Vite + TypeScript + Tailwind CSS 4</em></p>
<p>简体中文说明见 <a href="./README-CN.md">README-CN.md</a></p>
</div>

---

## Overview

**OpenClaw Web Assistant** is a browser extension that extracts the page title, main article text (Readability + Markdown), selection, and full-page plain text, then sends your messages (optionally with page context) to a local or remote **OpenClaw gateway** through an **OpenAI-compatible `/v1/chat/completions` endpoint**, displaying responses in streaming or non-streaming mode.

The extension does **not** run the model itself. You need a compatible gateway (default base URL: `http://localhost:18789`) and must set your **Token** and optional **Session Key** on the options page.

## Features

| Feature | Description |
|--------|-------------|
| **Side panel chat (Chrome)** | Toolbar icon opens the Side Panel; syncs context for the active tab; multi-turn chat and streaming. |
| **In-page floating assistant** | Content script injects a draggable icon and chat UI; hover quick prompts; fullscreen; chat history persisted per page URL. |
| **Context menu** | Configurable page-level and selection-level prompts; `{url}` and `{text}` placeholders; on Chrome, can open the side panel and fill/auto-send. |
| **Page context modes** | Article (Readability), full-page text, or current selection; context capped around 16k characters with truncation notice. |
| **Options** | Gateway URL, token, session key, UI language (简体中文 / English), multiple quick prompts. |
| **Firefox** | Build strips `sidePanel`; floating assistant and context-menu injection are primary (see below). |

## Requirements & permissions

- **Node.js**: 18+ recommended (matches CI).
- **Chrome**: Side Panel API recommended for the full side-panel experience.
- **Manifest**: `storage`, `contextMenus`, `activeTab`, `sidePanel` (Chrome), `scripting`, `tabs`, and `<all_urls>` `host_permissions` for the content script and page extraction.

## Quick start

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

**Firefox:**

```bash
npm run dev:firefox
# or
yarn dev:firefox
```

### 3. Load the extension

**Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the **`dist_chrome`** folder (created after dev or build)

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on** → pick `manifest.json` under **`dist_firefox`**

### 4. Configure the gateway

1. Open the popup from the toolbar or open **Options** from the extension menu.
2. Set **OpenClaw Token** (required), **gateway URL** (default `http://localhost:18789`; the extension normalizes to `.../v1/chat/completions`), and **Session Key** (default `agent:main:main`, adjust per your gateway).
3. Save, then chat from the side panel or the floating assistant.

## Usage

- **Toolbar icon**: On Chrome, tied to the **side panel** via `sidePanel.setPanelBehavior` in the background worker.
- **Floating assistant**: Draggable icon (often on the right); hover shows option-defined quick prompts; open the panel, pick a context mode, send.
- **Context menu**: Root title and items follow locale and stored prompt lists; page items substitute the tab URL; selection items substitute `{text}`.
- **Chat history**: Stored in `chrome.storage.local` keyed by normalized page URL and session (see `panelChatStore`) for multi-turn threads per page.

## Chrome vs Firefox

| | Chrome | Firefox |
|---|--------|---------|
| Side panel | Yes | No (`side_panel` removed from manifest) |
| Context menu → open panel & auto-send | Yes | Falls back to injecting text into the content script and auto-send |
| Output dir | `dist_chrome` | `dist_firefox` |

Production: `npm run build:chrome` / `npm run build:firefox` (same with `yarn`).

## Project layout (excerpt)

```
src/
  lib/openclaw/          # Gateway client, page extract, context compose, i18n, chat persistence
  pages/
    background/          # Service worker: menus, side panel, messaging, stream relay
    content/             # Floating assistant + in-page extraction
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
npm run build:firefox
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

Issues and pull requests are welcome. If you change the manifest, permissions, or build targets, please note the impact on Chrome vs Firefox behavior.
