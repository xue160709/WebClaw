import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

import type { PageContextSnapshot } from './pageContextMessages';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

/** Run only in a normal page document (content script world). */
export function extractPageInPage(): PageContextSnapshot {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const title = typeof document !== 'undefined' ? document.title || '' : '';
  let articleText = '';

  try {
    if (typeof document !== 'undefined') {
      const clone = document.cloneNode(true) as Document;
      const article = new Readability(clone).parse();
      const html = article?.content?.trim();
      const plain = article?.textContent?.trim() ?? '';

      if (html) {
        try {
          const md = turndown.turndown(html).trim();
          articleText = md || plain;
        } catch {
          articleText = plain;
        }
      } else if (plain) {
        articleText = plain;
      }
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
