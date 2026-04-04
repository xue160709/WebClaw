import type { OpenClawLocale } from './i18nData';

export const STORAGE = {
  TOKEN: 'openclaw_token',
  GATEWAY: 'openclaw_gateway',
  SESSION_KEY: 'openclaw_session_key',
  FADE_TIME: 'openclaw_fade_time',
  ICON_POS: 'openclaw_icon_pos',
  CUSTOM_ICON: 'openclaw_custom_icon',
  LANGUAGE: 'openclaw_language',
  PAGE_PROMPTS: 'openclaw_page_prompts',
  SELECTION_PROMPTS: 'openclaw_selection_prompts',
  IMAGE_PROMPTS: 'openclaw_image_prompts',
  /** Legacy single-string keys (options migrates these) */
  LEGACY_PAGE: 'openclaw_page_prompt',
  LEGACY_SELECTION: 'openclaw_selection_prompt',
  LEGACY_IMAGE: 'openclaw_image_prompt',
} as const;

export type PromptItem = { label: string; prompt: string };

export const DEFAULT_GATEWAY = 'http://localhost:18789';
export const DEFAULT_SESSION = 'agent:main:main';
export const DEFAULT_ICON = '🦞';
export const DEFAULT_FADE = 3;

export const DEFAULT_PROMPTS: {
  page: PromptItem[];
  selection: PromptItem[];
  image: PromptItem[];
} = {
  page: [{ label: 'Summarize', prompt: 'Summarize this page: {url}' }],
  selection: [{ label: 'Record', prompt: 'Record this to brain: {text}' }],
  image: [{ label: 'Explain', prompt: 'Explain this image: {imageUrl}' }],
};

export function normalizeLocale(v: string | undefined): OpenClawLocale {
  if (v === 'zh-TW' || v === 'en') return v;
  if (v && v.startsWith('zh')) return 'zh-TW';
  if (!v && typeof navigator !== 'undefined' && navigator.language.startsWith('zh')) {
    return 'zh-TW';
  }
  return 'en';
}
