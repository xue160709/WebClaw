import { Readability } from '@mozilla/readability';

import type { PageContextSnapshot } from './pageContextMessages';

/** Run only in a normal page document (content script world). */
export function extractPageInPage(): PageContextSnapshot {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const title = typeof document !== 'undefined' ? document.title || '' : '';
  let articleText = '';

  try {
    if (typeof document !== 'undefined') {
      const clone = document.cloneNode(true) as Document;
      const article = new Readability(clone).parse();
      const t = article?.textContent?.trim();
      if (t) articleText = t;
    }
  } catch {
    /* readability failed */
  }

  const fullText =
    typeof document !== 'undefined' && document.body
      ? document.body.innerText?.trim() ?? ''
      : '';

  if (!articleText && fullText) {
    articleText = fullText;
  }

  return { title, url, articleText, fullText };
}
