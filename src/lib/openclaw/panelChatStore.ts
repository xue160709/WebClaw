/** Side panel: per-page chat persistence + session key material for Gateway. */

export const PANEL_CHAT_DB_NAME = 'openclaw_panel_chat';
export const PANEL_CHAT_DB_VERSION = 1;
export const PANEL_CHAT_STORE = 'chats';
/** Short prefix for `x-openclaw-session-key` (keep header compact). */
export const PANEL_SESSION_KEY_PREFIX = 'ocw';

export type PanelStoredMsg = { role: 'user' | 'assistant'; text: string };

export type PanelChatRecord = {
  urlKey: string;
  threadId: string;
  sessionKey: string;
  messages: PanelStoredMsg[];
  updatedAt: number;
};

export function normalizePageUrlForChat(raw: string): string {
  const t = raw.trim();
  if (!t) return '_invalid';
  try {
    const u = new URL(t);
    if (u.protocol === 'about:' && (u.pathname === 'blank' || u.pathname === '')) {
      return '_invalid';
    }
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return '_invalid';
  }
}

export async function digestUrlKey(urlKey: string): Promise<string> {
  const enc = new TextEncoder().encode(urlKey);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 12 hex chars (6 random bytes); stored as `threadId` in IDB. */
export function newPanelThreadId(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Map stored thread id to 12 hex chars for the session key segment. */
function compactThreadSuffix(threadId: string): string {
  const t = threadId.trim();
  if (/^[0-9a-f]{12}$/i.test(t)) return t.toLowerCase();
  const hex = t.replace(/-/g, '').toLowerCase();
  if (hex.length >= 12 && /^[0-9a-f]+$/.test(hex)) return hex.slice(-12);
  return hex.slice(0, 12).padEnd(12, '0');
}

export async function buildPanelSessionKey(
  urlKey: string,
  threadId: string,
): Promise<string> {
  const digest = await digestUrlKey(urlKey);
  const urlBits = digest.slice(0, 10);
  return `${PANEL_SESSION_KEY_PREFIX}:${urlBits}:${compactThreadSuffix(threadId)}`;
}

function openPanelChatDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PANEL_CHAT_DB_NAME, PANEL_CHAT_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PANEL_CHAT_STORE)) {
        db.createObjectStore(PANEL_CHAT_STORE, { keyPath: 'urlKey' });
      }
    };
  });
}

export async function getPanelChatRecord(
  urlKey: string,
): Promise<PanelChatRecord | undefined> {
  const db = await openPanelChatDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PANEL_CHAT_STORE, 'readonly');
    const store = tx.objectStore(PANEL_CHAT_STORE);
    const g = store.get(urlKey);
    g.onerror = () => reject(g.error ?? new Error('get failed'));
    tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    tx.oncomplete = () => {
      const v = g.result as PanelChatRecord | undefined;
      db.close();
      resolve(v);
    };
  });
}

export async function putPanelChatRecord(record: PanelChatRecord): Promise<void> {
  const db = await openPanelChatDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PANEL_CHAT_STORE, 'readwrite');
    tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    const store = tx.objectStore(PANEL_CHAT_STORE);
    const p = store.put(record);
    p.onerror = () => reject(p.error ?? new Error('put failed'));
  });
}

export async function deletePanelChatRecord(urlKey: string): Promise<void> {
  const db = await openPanelChatDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PANEL_CHAT_STORE, 'readwrite');
    tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    const store = tx.objectStore(PANEL_CHAT_STORE);
    const d = store.delete(urlKey);
    d.onerror = () => reject(d.error ?? new Error('delete failed'));
  });
}

export function panelMessagesToStored(
  messages: { role: 'user' | 'assistant'; text: string; streamId?: string }[],
): PanelStoredMsg[] {
  return messages.map(({ role, text }) => ({ role, text }));
}
