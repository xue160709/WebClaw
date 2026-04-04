import { extractPageInPage } from '@src/lib/openclaw/extractPageInPage';
import {
  OPENCLAW_GET_PAGE_EXTRACT,
  OPENCLAW_SELECTION_CHANGED,
} from '@src/lib/openclaw/pageContextMessages';

export function registerPageContextBridge(): void {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === OPENCLAW_GET_PAGE_EXTRACT) {
      try {
        const { title, url, articleText, fullText } = extractPageInPage();
        sendResponse({ ok: true as const, title, url, articleText, fullText });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        sendResponse({ ok: false as const, error: msg });
      }
      return true;
    }
    return false;
  });

  let debounce: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener('selectionchange', () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      const text = window.getSelection()?.toString().trim() ?? '';
      try {
        const p = chrome.runtime.sendMessage({
          action: OPENCLAW_SELECTION_CHANGED,
          text,
        });
        void p.catch(() => {
          /* no receiver or stale content-script context */
        });
      } catch {
        /* extension context invalidated after reload */
      }
    }, 220);
  });
}
