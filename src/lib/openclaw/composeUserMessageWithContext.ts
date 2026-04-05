import type { OpenClawLocale } from './i18nData';
import { tString } from './i18nData';

export type ContextMode = 'article' | 'full' | 'selection';

export const OPENCLAW_MAX_CONTEXT_CHARS = 16_000;

export type PageContextForCompose = {
  title: string;
  url: string;
  articleText: string;
  fullText: string;
  selectionText: string;
};

function contextLabel(locale: OpenClawLocale, mode: ContextMode): string {
  if (mode === 'article') return tString(locale, 'contextArticle');
  if (mode === 'full') return tString(locale, 'contextFullPage');
  return tString(locale, 'contextSelection');
}

function pickBody(snapshot: PageContextForCompose, mode: ContextMode): string {
  if (mode === 'selection') return '';
  if (mode === 'full') return snapshot.fullText.trim();
  return snapshot.articleText.trim();
}

function buildSelectionModeBody(
  snapshot: PageContextForCompose,
  locale: OpenClawLocale,
): { body: string; truncated: boolean } {
  const sel = snapshot.selectionText.trim();
  if (!sel) {
    return { body: '', truncated: false };
  }

  const hLabel = tString(locale, 'contextSelectionHighlight');
  const truncSuffix = '\n…' + tString(locale, 'contextTruncated');
  const prefix = `${hLabel}: `;
  const max = OPENCLAW_MAX_CONTEXT_CHARS;
  let body = prefix + sel;

  if (body.length <= max) {
    return { body, truncated: false };
  }

  const budget = Math.max(0, max - prefix.length - truncSuffix.length);
  body = prefix + sel.slice(0, budget) + truncSuffix;
  return { body, truncated: true };
}

/**
 * Appends page context to the user message for the chat API.
 * Returns the final string and whether the body was truncated.
 */
export function composeUserMessageWithContext(
  userText: string,
  mode: ContextMode,
  snapshot: PageContextForCompose,
  locale: OpenClawLocale,
): { text: string; truncated: boolean } {
  const trimmedUser = userText.trim();

  let body: string;
  let truncated: boolean;
  let label: string;

  if (mode === 'selection') {
    const built = buildSelectionModeBody(snapshot, locale);
    body = built.body;
    truncated = built.truncated;
    label = contextLabel(locale, mode);
    if (!body) {
      return { text: trimmedUser, truncated: false };
    }
  } else {
    label = contextLabel(locale, mode);
    body = pickBody(snapshot, mode);
    if (!body) {
      return { text: trimmedUser, truncated: false };
    }
    truncated = false;
    if (body.length > OPENCLAW_MAX_CONTEXT_CHARS) {
      body =
        body.slice(0, OPENCLAW_MAX_CONTEXT_CHARS) +
        '\n…' +
        tString(locale, 'contextTruncated');
      truncated = true;
    }
  }

  const header = tString(locale, 'contextBlockHeader');
  const block = `${header}\n${tString(locale, 'contextPageTitle')}: ${snapshot.title}\n${tString(locale, 'contextPageUrl')}: ${snapshot.url}\n${tString(locale, 'contextType')}: ${label}\n\n${body}\n---`;

  return { text: `${trimmedUser}\n\n${block}`, truncated };
}
