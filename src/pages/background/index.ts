import {
  DEFAULT_PROMPTS,
  STORAGE,
  normalizeLocale,
  type PromptItem,
} from '@src/lib/openclaw/constants';
import {
  consumeChatCompletionStream,
  prepareChatCompletionPost,
} from '@src/lib/openclaw/gateway';
import { tString, type OpenClawLocale } from '@src/lib/openclaw/i18nData';
import {
  buildPanelSessionKey,
  deletePanelChatRecord,
  getPanelChatRecord,
  normalizePageUrlForChat,
  putPanelChatRecord,
  type PanelChatRecord,
} from '@src/lib/openclaw/panelChatStore';
import {
  OPENCLAW_ACTIVE_TAB_CONTEXT,
  OPENCLAW_CHAT_HISTORY_DELETE,
  OPENCLAW_CHAT_HISTORY_GET,
  OPENCLAW_CHAT_HISTORY_PUT,
  OPENCLAW_GET_PAGE_EXTRACT,
  OPENCLAW_REQUEST_ACTIVE_TAB_CONTEXT,
  OPENCLAW_SELECTION_CHANGED,
  OPENCLAW_SELECTION_SYNC,
} from '@src/lib/openclaw/pageContextMessages';

const MENU_ROOT = 'openclaw-root';

async function pushContextToExtension(msg: object): Promise<void> {
  try {
    await chrome.runtime.sendMessage(msg);
  } catch {
    /* no panel or popup listening */
  }
}

async function broadcastPageContextForTab(tabId: number): Promise<void> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  const windowId = tab.windowId;
  if (windowId === undefined) return;

  const fallback = () => ({
    title: tab.title ?? '',
    url: tab.url ?? '',
    articleText: '',
    fullText: '',
    error: 'no_content_script' as const,
  });

  try {
    const res = (await chrome.tabs.sendMessage(tabId, {
      action: OPENCLAW_GET_PAGE_EXTRACT,
    })) as
      | {
          ok: true;
          title: string;
          url: string;
          articleText: string;
          fullText: string;
        }
      | { ok: false; error?: string }
      | undefined;

    if (res?.ok) {
      await pushContextToExtension({
        action: OPENCLAW_ACTIVE_TAB_CONTEXT,
        windowId,
        tabId,
        title: res.title,
        url: res.url,
        articleText: res.articleText,
        fullText: res.fullText,
      });
      return;
    }

    const base = fallback();
    base.error =
      res?.ok === false ? (res.error ?? 'extract_failed') : 'no_response';
    await pushContextToExtension({
      action: OPENCLAW_ACTIVE_TAB_CONTEXT,
      windowId,
      tabId,
      ...base,
    });
  } catch {
    await pushContextToExtension({
      action: OPENCLAW_ACTIVE_TAB_CONTEXT,
      windowId,
      tabId,
      ...fallback(),
    });
  }
}

let activeTabContextListenersRegistered = false;

function initActiveTabContextListeners(): void {
  if (!supportsSidePanel() || activeTabContextListenersRegistered) return;
  activeTabContextListenersRegistered = true;

  chrome.tabs.onActivated.addListener((activeInfo) => {
    void broadcastPageContextForTab(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return;
    void (async () => {
      try {
        const t = await chrome.tabs.get(tabId);
        const [active] = await chrome.tabs.query({
          active: true,
          windowId: t.windowId,
        });
        if (active?.id === tabId) {
          await broadcastPageContextForTab(tabId);
        }
      } catch {
        /* tab gone */
      }
    })();
  });
}

function supportsSidePanel(): boolean {
  return typeof chrome.sidePanel?.setPanelBehavior === 'function';
}

async function getMenuLocale(): Promise<OpenClawLocale> {
  const r = await chrome.storage.local.get([STORAGE.LANGUAGE]);
  return normalizeLocale(r[STORAGE.LANGUAGE] as string | undefined);
}

async function updateContextMenu() {
  const locale = await getMenuLocale();
  const rootTitle = tString(locale, 'menuRootTitle');

  const result = await chrome.storage.local.get([
    STORAGE.PAGE_PROMPTS,
    STORAGE.SELECTION_PROMPTS,
  ]);

  const pagePrompts =
    (result[STORAGE.PAGE_PROMPTS] as PromptItem[]) || DEFAULT_PROMPTS.page;
  const selectionPrompts =
    (result[STORAGE.SELECTION_PROMPTS] as PromptItem[]) ||
    DEFAULT_PROMPTS.selection;

  await chrome.contextMenus.removeAll();

  await chrome.contextMenus.create({
    id: MENU_ROOT,
    title: rootTitle,
    contexts: ['page', 'selection'],
  });

  pagePrompts.forEach((item, index) => {
    chrome.contextMenus.create({
      parentId: MENU_ROOT,
      id: `openclaw-page-${index}`,
      title: item.label,
      contexts: ['page'],
    });
  });

  selectionPrompts.forEach((item, index) => {
    chrome.contextMenus.create({
      parentId: MENU_ROOT,
      id: `openclaw-selection-${index}`,
      title: item.label,
      contexts: ['selection'],
    });
  });
}

function initSidePanelClickOpensPanel() {
  if (!supportsSidePanel()) return;
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.error('sidePanel.setPanelBehavior:', e));
}

chrome.runtime.onInstalled.addListener(async () => {
  initSidePanelClickOpensPanel();
  await updateContextMenu();
});

chrome.runtime.onStartup?.addListener(() => {
  initSidePanelClickOpensPanel();
});

initActiveTabContextListeners();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  void updateContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const menuId = String(info.menuItemId);

  void chrome.storage.local
    .get([STORAGE.PAGE_PROMPTS, STORAGE.SELECTION_PROMPTS])
    .then(async (result) => {
      const pagePrompts =
        (result[STORAGE.PAGE_PROMPTS] as PromptItem[]) || DEFAULT_PROMPTS.page;
      const selectionPrompts =
        (result[STORAGE.SELECTION_PROMPTS] as PromptItem[]) ||
        DEFAULT_PROMPTS.selection;

      let promptTemplate = '';
      let contextType: 'page' | 'selection' | '' = '';

      if (menuId.startsWith('openclaw-page-')) {
        const index = parseInt(menuId.replace('openclaw-page-', ''), 10);
        if (pagePrompts[index]) {
          promptTemplate = pagePrompts[index].prompt;
          contextType = 'page';
        }
      } else if (menuId.startsWith('openclaw-selection-')) {
        const index = parseInt(menuId.replace('openclaw-selection-', ''), 10);
        if (selectionPrompts[index]) {
          promptTemplate = selectionPrompts[index].prompt;
          contextType = 'selection';
        }
      }

      if (!promptTemplate) return;

      let finalPrompt = promptTemplate;
      finalPrompt = finalPrompt.replace(/{url}/g, tab.url || '');

      if (contextType === 'selection' && info.selectionText) {
        finalPrompt = finalPrompt.replace(/{text}/g, info.selectionText);
      }

      finalPrompt = finalPrompt.replace(/{imageUrl}/g, '');

      if (supportsSidePanel() && tab.windowId !== undefined) {
        await chrome.storage.local.set({
          [STORAGE.PENDING_PANEL_INJECT]: {
            text: finalPrompt,
            autoSend: true,
            ts: Date.now(),
          },
        });
        try {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (e) {
          console.error('sidePanel.open:', e);
        }
        return;
      }

      void chrome.tabs.sendMessage(tab.id!, {
        action: 'injectText',
        text: finalPrompt,
        autoSend: true,
      });
    });
});

async function pushStreamEvent(
  tabId: number | undefined,
  msg: object,
): Promise<void> {
  if (supportsSidePanel()) {
    try {
      await chrome.runtime.sendMessage(msg);
    } catch {
      /* no extension page listening */
    }
    return;
  }
  if (tabId !== undefined) {
    try {
      await chrome.tabs.sendMessage(tabId, msg);
    } catch {
      /* tab closed or no content script */
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === OPENCLAW_SELECTION_CHANGED) {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    void chrome.tabs.get(tabId).then(
      (tab) => {
        void pushContextToExtension({
          action: OPENCLAW_SELECTION_SYNC,
          windowId: tab.windowId,
          tabId,
          text: String(request.text ?? ''),
        });
      },
      () => {
        /* tab closed */
      },
    );
    return;
  }

  if (request?.action === OPENCLAW_REQUEST_ACTIVE_TAB_CONTEXT) {
    void (async () => {
      try {
        const [active] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (active?.id !== undefined) {
          await broadcastPageContextForTab(active.id);
        }
      } finally {
        sendResponse({ ok: true });
      }
    })();
    return true;
  }

  if (request?.action === OPENCLAW_CHAT_HISTORY_GET) {
    void (async () => {
      try {
        const rawUrl = String(request.url ?? '');
        const urlKey = normalizePageUrlForChat(rawUrl);
        const rec = await getPanelChatRecord(urlKey);
        if (!rec) {
          sendResponse({ ok: true, urlKey, record: null });
          return;
        }
        const sessionKey = await buildPanelSessionKey(urlKey, rec.threadId);
        const nextRecord =
          rec.sessionKey === sessionKey
            ? rec
            : {
                ...rec,
                sessionKey,
                updatedAt: Date.now(),
              };
        if (nextRecord !== rec) {
          await putPanelChatRecord(nextRecord);
        }
        sendResponse({ ok: true, urlKey, record: nextRecord });
      } catch (error: unknown) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  if (request?.action === OPENCLAW_CHAT_HISTORY_PUT) {
    void (async () => {
      try {
        const record = request.record as PanelChatRecord | undefined;
        if (!record?.urlKey || !record.threadId || !record.sessionKey) {
          sendResponse({ ok: false, error: 'Invalid chat history record' });
          return;
        }
        await putPanelChatRecord(record);
        sendResponse({ ok: true });
      } catch (error: unknown) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  if (request?.action === OPENCLAW_CHAT_HISTORY_DELETE) {
    void (async () => {
      try {
        const rawUrl = String(request.url ?? '');
        const urlKey = normalizePageUrlForChat(rawUrl);
        await deletePanelChatRecord(urlKey);
        sendResponse({ ok: true, urlKey });
      } catch (error: unknown) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  if (request?.action === 'openOptions') {
    void chrome.runtime.openOptionsPage();
    return;
  }
  if (request?.action === 'sendMessage') {
    const text = String(request.text ?? '');
    const tabId =
      typeof request.tabId === 'number' ? request.tabId : sender.tab?.id;

    void (async () => {
      const sessionKey =
        typeof request.sessionKey === 'string' && request.sessionKey.trim()
          ? request.sessionKey.trim()
          : undefined;
      const prep = await prepareChatCompletionPost(text, true, { sessionKey });
      if (!prep.ok) {
        sendResponse({ success: false, error: prep.error });
        return;
      }

      const requestId =
        typeof request.requestId === 'string' && request.requestId
          ? request.requestId
          : crypto.randomUUID();

      sendResponse({ success: true, streaming: true, requestId });

      try {
        for await (const delta of consumeChatCompletionStream(prep)) {
          await pushStreamEvent(tabId, {
            action: 'streamDelta',
            requestId,
            delta,
          });
        }
        await pushStreamEvent(tabId, {
          action: 'streamComplete',
          requestId,
        });
      } catch (error: unknown) {
        console.error('Stream API Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        await pushStreamEvent(tabId, {
          action: 'streamError',
          requestId,
          error: message,
        });
      }
    })();

    return true;
  }
  return;
});
