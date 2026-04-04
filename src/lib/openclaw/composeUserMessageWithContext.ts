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
  if (mode === 'selection') return snapshot.selectionText.trim();
  if (mode === 'full') return snapshot.fullText.trim();
  return snapshot.articleText.trim();
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
  const body = pickBody(snapshot, mode);
  const label = contextLabel(locale, mode);

  if (!body) {
    return { text: trimmedUser, truncated: false };
  }

  let truncated = false;
  let useBody = body;
  if (useBody.length > OPENCLAW_MAX_CONTEXT_CHARS) {
    useBody =
      useBody.slice(0, OPENCLAW_MAX_CONTEXT_CHARS) +
      '\n…' +
      tString(locale, 'contextTruncated');
    truncated = true;
  }

  const header = tString(locale, 'contextBlockHeader');
  const block = `${header}\n${tString(locale, 'contextPageTitle')}: ${snapshot.title}\n${tString(locale, 'contextPageUrl')}: ${snapshot.url}\n${tString(locale, 'contextType')}: ${label}\n\n${useBody}\n---`;

  return { text: `${trimmedUser}\n\n${block}`, truncated };
}
