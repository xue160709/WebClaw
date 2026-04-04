/** IPC between content script, background, and panel (must stay in sync). */

export const OPENCLAW_GET_PAGE_EXTRACT = 'openclaw:getPageExtract' as const;

export const OPENCLAW_SELECTION_CHANGED = 'openclaw:selectionChanged' as const;

export const OPENCLAW_ACTIVE_TAB_CONTEXT = 'openclaw:activeTabContext' as const;

export const OPENCLAW_SELECTION_SYNC = 'openclaw:selectionSync' as const;

export const OPENCLAW_REQUEST_ACTIVE_TAB_CONTEXT =
  'openclaw:requestActiveTabContext' as const;

export const OPENCLAW_CHAT_HISTORY_GET = 'openclaw:chatHistoryGet' as const;

export const OPENCLAW_CHAT_HISTORY_PUT = 'openclaw:chatHistoryPut' as const;

export const OPENCLAW_CHAT_HISTORY_DELETE = 'openclaw:chatHistoryDelete' as const;

export type PageContextSnapshot = {
  title: string;
  url: string;
  articleText: string;
  fullText: string;
  error?: string;
};

export type ActiveTabContextMessage = {
  action: typeof OPENCLAW_ACTIVE_TAB_CONTEXT;
  windowId: number;
  tabId: number;
} & PageContextSnapshot;

export type SelectionSyncMessage = {
  action: typeof OPENCLAW_SELECTION_SYNC;
  windowId: number;
  tabId: number;
  text: string;
};
