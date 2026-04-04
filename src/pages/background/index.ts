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

const MENU_ROOT = 'openclaw-root';

function supportsSidePanel(): boolean {
  return typeof chrome.sidePanel?.setPanelBehavior === 'function';
}

async function getMenuLocale(): Promise<OpenClawLocale> {
  const r = await chrome.storage.local.get([STORAGE.LANGUAGE]);
  return normalizeLocale(r[STORAGE.LANGUAGE] as string | undefined);
}

async function updateActionIcon(emoji: string | undefined) {
  if (!emoji) return;
  try {
    const size = 32;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.font = `${size - 4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 2);
    const imageData = ctx.getImageData(0, 0, size, size);
    await chrome.action.setIcon({ imageData });
  } catch (e) {
    console.error('Failed to update icon:', e);
  }
}

async function updateContextMenu() {
  const locale = await getMenuLocale();
  const rootTitle = tString(locale, 'menuRootTitle');

  const result = await chrome.storage.local.get([
    STORAGE.PAGE_PROMPTS,
    STORAGE.SELECTION_PROMPTS,
    STORAGE.IMAGE_PROMPTS,
  ]);

  const pagePrompts =
    (result[STORAGE.PAGE_PROMPTS] as PromptItem[]) || DEFAULT_PROMPTS.page;
  const selectionPrompts =
    (result[STORAGE.SELECTION_PROMPTS] as PromptItem[]) ||
    DEFAULT_PROMPTS.selection;
  const imagePrompts =
    (result[STORAGE.IMAGE_PROMPTS] as PromptItem[]) || DEFAULT_PROMPTS.image;

  await chrome.contextMenus.removeAll();

  await chrome.contextMenus.create({
    id: MENU_ROOT,
    title: rootTitle,
    contexts: ['page', 'selection', 'image'],
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

  imagePrompts.forEach((item, index) => {
    chrome.contextMenus.create({
      parentId: MENU_ROOT,
      id: `openclaw-image-${index}`,
      title: item.label,
      contexts: ['image'],
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
  const r = await chrome.storage.local.get([STORAGE.CUSTOM_ICON]);
  if (r[STORAGE.CUSTOM_ICON]) {
    await updateActionIcon(r[STORAGE.CUSTOM_ICON] as string);
  }
});

chrome.runtime.onStartup?.addListener(() => {
  initSidePanelClickOpensPanel();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  void updateContextMenu();
  const iconChange = changes[STORAGE.CUSTOM_ICON];
  if (iconChange) {
    void updateActionIcon(iconChange.newValue as string | undefined);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const menuId = String(info.menuItemId);

  void chrome.storage.local
    .get([
      STORAGE.PAGE_PROMPTS,
      STORAGE.SELECTION_PROMPTS,
      STORAGE.IMAGE_PROMPTS,
    ])
    .then(async (result) => {
      const pagePrompts =
        (result[STORAGE.PAGE_PROMPTS] as PromptItem[]) || DEFAULT_PROMPTS.page;
      const selectionPrompts =
        (result[STORAGE.SELECTION_PROMPTS] as PromptItem[]) ||
        DEFAULT_PROMPTS.selection;
      const imagePrompts =
        (result[STORAGE.IMAGE_PROMPTS] as PromptItem[]) || DEFAULT_PROMPTS.image;

      let promptTemplate = '';
      let contextType: 'page' | 'selection' | 'image' | '' = '';
      let imageUrl: string | null = null;

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
      } else if (menuId.startsWith('openclaw-image-')) {
        const index = parseInt(menuId.replace('openclaw-image-', ''), 10);
        if (imagePrompts[index]) {
          promptTemplate = imagePrompts[index].prompt;
          contextType = 'image';
        }
      }

      if (!promptTemplate) return;

      let finalPrompt = promptTemplate;
      finalPrompt = finalPrompt.replace(/{url}/g, tab.url || '');

      if (contextType === 'selection' && info.selectionText) {
        finalPrompt = finalPrompt.replace(/{text}/g, info.selectionText);
      }

      if (contextType === 'image' && info.srcUrl) {
        finalPrompt = finalPrompt.replace(/{imageUrl}/g, info.srcUrl);
        imageUrl = info.srcUrl;
      }

      if (supportsSidePanel() && tab.windowId !== undefined) {
        await chrome.storage.local.set({
          [STORAGE.PENDING_PANEL_INJECT]: {
            text: finalPrompt,
            autoSend: true,
            imageUrl,
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
        imageUrl,
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
  if (request?.action === 'openOptions') {
    void chrome.runtime.openOptionsPage();
    return;
  }
  if (request?.action === 'sendMessage') {
    const text = String(request.text ?? '');
    const tabId =
      typeof request.tabId === 'number' ? request.tabId : sender.tab?.id;

    void (async () => {
      const prep = await prepareChatCompletionPost(text, true);
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
