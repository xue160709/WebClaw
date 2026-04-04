import {
  DEFAULT_GATEWAY,
  DEFAULT_SESSION,
  STORAGE,
} from './constants';

export type SendMessageResult =
  | { success: true; data: string }
  | { success: false; error: string };

export type PreparedChatPost =
  | { ok: false; error: string }
  | {
      ok: true;
      url: string;
      headers: Record<string, string>;
      body: {
        model: string;
        messages: { role: 'user'; content: string }[];
        stream: boolean;
      };
    };

export async function prepareChatCompletionPost(
  text: string,
  stream: boolean,
): Promise<PreparedChatPost> {
  const storage = await chrome.storage.local.get([
    STORAGE.TOKEN,
    STORAGE.GATEWAY,
    STORAGE.SESSION_KEY,
  ]);
  const token = storage[STORAGE.TOKEN] as string | undefined;
  let gateway = (storage[STORAGE.GATEWAY] as string) || DEFAULT_GATEWAY;
  const sessionKey =
    (storage[STORAGE.SESSION_KEY] as string) || DEFAULT_SESSION;

  if (!token) {
    return {
      ok: false,
      error: 'Token required（请先设置 Token）',
    };
  }

  if (!gateway.includes('/v1/chat/completions')) {
    if (gateway.endsWith('/')) gateway = gateway.slice(0, -1);
    gateway += '/v1/chat/completions';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (sessionKey) headers['x-openclaw-session-key'] = sessionKey;

  return {
    ok: true,
    url: gateway,
    headers,
    body: {
      model: 'openclaw',
      messages: [{ role: 'user', content: text }],
      stream,
    },
  };
}

async function* parseOpenAIEventStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const nl = buffer.indexOf('\n');
        if (nl === -1) break;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const trimmed = line.replace(/\r$/, '');
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trimStart();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string | null } }[];
            response?: string;
            error?: { message?: string };
          };
          if (json.error?.message) {
            throw new Error(json.error.message);
          }
          const piece = json.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece.length > 0) {
            yield piece;
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function extractNonStreamText(data: {
  choices?: { message?: { content?: string } }[];
  response?: string;
}): string {
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (data.response) {
    return data.response;
  }
  return JSON.stringify(data);
}

/** Consume a prepared streaming POST; `prep.body.stream` must be true. */
export async function* consumeChatCompletionStream(
  prep: Extract<PreparedChatPost, { ok: true }>,
): AsyncGenerator<string> {
  const response = await fetch(prep.url, {
    method: 'POST',
    headers: prep.headers,
    body: JSON.stringify(prep.body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} ${errText}`);
  }

  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('text/event-stream')) {
    const body = response.body;
    if (!body) throw new Error('Empty response body');
    yield* parseOpenAIEventStream(body);
    return;
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    response?: string;
  };
  yield extractNonStreamText(data);
}

export async function sendChatCompletion(text: string): Promise<SendMessageResult> {
  const prep = await prepareChatCompletionPost(text, false);
  if (!prep.ok) {
    return { success: false, error: prep.error };
  }

  const response = await fetch(prep.url, {
    method: 'POST',
    headers: prep.headers,
    body: JSON.stringify(prep.body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    response?: string;
  };

  return { success: true, data: extractNonStreamText(data) };
}
