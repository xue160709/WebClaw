import type { OpenClawLocale } from './i18nData';

export const STORAGE = {
  TOKEN: 'openclaw_token',
  GATEWAY: 'openclaw_gateway',
  SESSION_KEY: 'openclaw_session_key',
  ICON_POS: 'openclaw_icon_pos',
  LANGUAGE: 'openclaw_language',
  PAGE_PROMPTS: 'openclaw_page_prompts',
  SELECTION_PROMPTS: 'openclaw_selection_prompts',
  /** Legacy single-string keys (options migrates these) */
  LEGACY_PAGE: 'openclaw_page_prompt',
  LEGACY_SELECTION: 'openclaw_selection_prompt',
  /** Set by background when context menu opens the side panel before inject */
  PENDING_PANEL_INJECT: 'openclaw_pending_panel_inject',
} as const;

export type PromptItem = { label: string; prompt: string };

export const DEFAULT_GATEWAY = 'http://localhost:18789';
export const DEFAULT_SESSION = 'agent:main:main';
export const DEFAULT_ICON = '🦞';
export const DEFAULT_FADE = 3;

export const DEFAULT_PROMPTS: {
  page: PromptItem[];
  selection: PromptItem[];
} = {
  page: [{ label: 'Summarize', prompt: 'Summarize this page: {url}' }],
  selection: [{ label: 'Record', prompt: 'Record this to brain: {text}' }],
};

export function normalizeLocale(v: string | undefined): OpenClawLocale {
  if (v === 'zh-CN' || v === 'en') return v;
  /** 旧版存储为 zh-TW，统一视为简体中文包 */
  if (v === 'zh-TW') return 'zh-CN';
  if (v && v.startsWith('zh')) return 'zh-CN';
  if (!v && typeof navigator !== 'undefined' && navigator.language.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}
