import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FADE,
  DEFAULT_GATEWAY,
  DEFAULT_PROMPTS,
  STORAGE,
  normalizeLocale,
  type PromptItem,
} from '@src/lib/openclaw/constants';
import {
  SendIcon,
  SettingsIcon,
} from '@src/components/OpenClawIcons';
import { tString, type OpenClawLocale } from '@src/lib/openclaw/i18nData';
import { parseOpenclawMarkdown } from '@src/lib/openclaw/markdown';
import '@pages/panel/openclaw-panel.css';

type Msg = { role: 'user' | 'assistant'; text: string; streamId?: string };

type PendingInject = {
  text: string;
  autoSend?: boolean;
  ts?: number;
};

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function getSelectionFromActiveTab(): Promise<string> {
  const tab = await getActiveTab();
  if (!tab?.id) return '';
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? '',
    });
    const first = results[0];
    return typeof first?.result === 'string' ? first.result : '';
  } catch {
    return '';
  }
}

function applyPendingInject(
  pending: PendingInject,
  opts: {
    setInputValue: (v: string) => void;
    sendWithText: (t: string) => void;
    restoreDialog: () => void;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
  },
) {
  const { text, autoSend } = pending;
  opts.restoreDialog();
  opts.setInputValue(text);
  queueMicrotask(() => {
    const el = opts.inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
    if (autoSend && text.trim()) {
      opts.sendWithText(text);
    }
  });
}

export default function Panel() {
  const [locale, setLocale] = useState<OpenClawLocale>('zh-CN');
  const [isFaded, setIsFaded] = useState(false);
  const [pagePrompts, setPagePrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.page,
  );
  const [selectionPrompts, setSelectionPrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.selection,
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const didInitWelcome = useRef(false);

  const fadeSecRef = useRef(DEFAULT_FADE);
  const gatewayRef = useRef(DEFAULT_GATEWAY);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = useCallback((key: string) => tString(locale, key), [locale]);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const restoreDialog = useCallback(() => {
    clearFadeTimer();
    setIsFaded(false);
  }, [clearFadeTimer]);

  const startFadeCountdown = useCallback(() => {
    clearFadeTimer();
    const ms = Math.max(1000, (fadeSecRef.current || DEFAULT_FADE) * 1000);
    fadeTimerRef.current = setTimeout(() => setIsFaded(true), ms);
  }, [clearFadeTimer]);

  const loadPromptsFromStorage = useCallback(() => {
    chrome.storage.local.get(
      [STORAGE.PAGE_PROMPTS, STORAGE.SELECTION_PROMPTS],
      (result) => {
        const p = result[STORAGE.PAGE_PROMPTS] as PromptItem[] | undefined;
        const s = result[STORAGE.SELECTION_PROMPTS] as PromptItem[] | undefined;
        if (p?.length) setPagePrompts(p);
        else setPagePrompts(DEFAULT_PROMPTS.page);
        if (s?.length) setSelectionPrompts(s);
        else setSelectionPrompts(DEFAULT_PROMPTS.selection);
      },
    );
  }, []);

  const loadFromStorage = useCallback(() => {
    chrome.storage.local.get([STORAGE.LANGUAGE, STORAGE.GATEWAY], (result) => {
      if (result[STORAGE.GATEWAY]) {
        gatewayRef.current = result[STORAGE.GATEWAY] as string;
      }
      const loc = normalizeLocale(result[STORAGE.LANGUAGE] as string | undefined);
      setLocale(loc);
      if (!didInitWelcome.current) {
        didInitWelcome.current = true;
        setMessages([
          { role: 'assistant', text: tString(loc, 'defaultWelcome') },
        ]);
      }
    });
    loadPromptsFromStorage();
  }, [loadPromptsFromStorage]);

  useEffect(() => {
    loadFromStorage();
    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local') return;
      if (
        changes[STORAGE.LANGUAGE] ||
        changes[STORAGE.GATEWAY] ||
        changes[STORAGE.PAGE_PROMPTS] ||
        changes[STORAGE.SELECTION_PROMPTS]
      ) {
        loadFromStorage();
      }
      const pending = changes[STORAGE.PENDING_PANEL_INJECT];
      if (pending?.newValue && typeof pending.newValue === 'object') {
        const v = pending.newValue as PendingInject;
        if (v.text) {
          applyPendingInject(v, {
            setInputValue,
            sendWithText: (text) => {
              void sendWithTextRef.current(text);
            },
            restoreDialog,
            inputRef,
          });
          void chrome.storage.local.remove(STORAGE.PENDING_PANEL_INJECT);
        }
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [loadFromStorage, restoreDialog]);

  const sendWithTextRef = useRef<(raw: string) => void>((_raw) => {});

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [{ role: 'assistant', text: tString(locale, 'defaultWelcome') }];
      }
      return prev;
    });
  }, [locale]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const sendWithText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming) return;

      const tab = await getActiveTab();
      const tabId = tab?.id;
      const requestId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { role: 'user', text },
        { role: 'assistant', text: '', streamId: requestId },
      ]);
      setInputValue('');
      restoreDialog();
      setIsStreaming(true);

      chrome.runtime.sendMessage(
        {
          action: 'sendMessage',
          text,
          requestId,
          tabId,
          context: { url: tab?.url ?? '', title: tab?.title ?? '' },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setIsStreaming(false);
            const err = chrome.runtime.lastError.message;
            setMessages((prev) =>
              prev.map((m) =>
                m.streamId === requestId
                  ? { role: 'assistant', text: 'Error: ' + err }
                  : m,
              ),
            );
            return;
          }
          if (response?.streaming) {
            return;
          }
          setIsStreaming(false);
          if (response?.success && typeof response.data === 'string') {
            setMessages((prev) =>
              prev.map((m) =>
                m.streamId === requestId
                  ? { role: 'assistant', text: response.data }
                  : m,
              ),
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.streamId === requestId
                  ? {
                      role: 'assistant',
                      text: 'Error: ' + (response?.error ?? 'Unknown error'),
                    }
                  : m,
              ),
            );
          }
        },
      );
    },
    [isStreaming, restoreDialog],
  );

  sendWithTextRef.current = sendWithText;

  const sendMessage = useCallback(() => {
    if (isStreaming) return;
    void sendWithText(inputValue);
  }, [inputValue, isStreaming, sendWithText]);

  const processQuickAction = useCallback(
    async (template: string, extra: { text?: string } = {}) => {
      const tab = await getActiveTab();
      let text = template;
      text = text.replace(/{url}/g, tab?.url ?? '');
      text = text.replace(/{text}/g, extra.text ?? '');
      text = text.replace(/{imageUrl}/g, '');
      restoreDialog();
      void sendWithText(text);
    },
    [restoreDialog, sendWithText],
  );

  useEffect(() => {
    chrome.storage.local.get([STORAGE.PENDING_PANEL_INJECT], (r) => {
      const p = r[STORAGE.PENDING_PANEL_INJECT] as PendingInject | undefined;
      if (p?.text) {
        applyPendingInject(p, {
          setInputValue,
          sendWithText: (txt) => {
            void sendWithTextRef.current(txt);
          },
          restoreDialog,
          inputRef,
        });
        void chrome.storage.local.remove(STORAGE.PENDING_PANEL_INJECT);
      }
    });
  }, [restoreDialog]);

  useEffect(() => {
    const onMsg = (request: {
      action?: string;
      text?: string;
      autoSend?: boolean;
      requestId?: string;
      delta?: string;
      error?: string;
    }) => {
      if (
        request.action === 'streamDelta' &&
        request.requestId &&
        typeof request.delta === 'string'
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            m.streamId === request.requestId
              ? { ...m, text: m.text + request.delta }
              : m,
          ),
        );
        return;
      }
      if (request.action === 'streamComplete' && request.requestId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.streamId === request.requestId
              ? { role: m.role, text: m.text }
              : m,
          ),
        );
        setIsStreaming(false);
        return;
      }
      if (request.action === 'streamError' && request.requestId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.streamId === request.requestId
              ? {
                  role: 'assistant',
                  text: 'Error: ' + (request.error ?? 'Unknown error'),
                }
              : m,
          ),
        );
        setIsStreaming(false);
        return;
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    if (e.target.value === '') e.target.style.height = '';
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) void sendMessage();
    }
  };

  const openSettings = () => {
    void chrome.runtime.sendMessage({ action: 'openOptions' });
  };

  const chatClass = [
    'openclaw-panel-chat',
    isFaded ? 'openclaw-faded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const quickBtn = (p: PromptItem, run: () => void) => (
    <button
      key={p.label + p.prompt.slice(0, 12)}
      type="button"
      className="openclaw-panel-quick-btn"
      title={p.prompt}
      onClick={() => {
        restoreDialog();
        void run();
      }}
    >
      {p.label}
    </button>
  );

  return (
    <div className="openclaw-panel-root">
      <div className="openclaw-panel-header">
        <span className="openclaw-title">
          {t('assistantName')}
        </span>
        <div className="openclaw-panel-controls">
          <button
            type="button"
            className="openclaw-btn-icon"
            title={t('settings')}
            onClick={openSettings}
          >
            <SettingsIcon className="openclaw-icon-svg" />
          </button>
        </div>
      </div>

      <div className="openclaw-panel-quick">
        <div className="openclaw-panel-quick-block">
          <div className="openclaw-panel-quick-title">{t('modePage')}</div>
          <div className="openclaw-panel-quick-btns">
            {pagePrompts.map((p) =>
              quickBtn(p, () => void processQuickAction(p.prompt)),
            )}
          </div>
        </div>
        <div className="openclaw-panel-quick-block">
          <div className="openclaw-panel-quick-title">{t('modeSelection')}</div>
          <div className="openclaw-panel-quick-btns">
            {selectionPrompts.map((p) =>
              quickBtn(p, async () => {
                const sel = (await getSelectionFromActiveTab()).trim();
                void processQuickAction(p.prompt, { text: sel });
              }),
            )}
          </div>
        </div>
      </div>

      <div
        className={chatClass}
        onMouseEnter={restoreDialog}
        onMouseLeave={() => {
          if (document.activeElement === inputRef.current) return;
          startFadeCountdown();
        }}
      >
        <div className="openclaw-messages">
          {messages.map((m, i) =>
            m.role === 'assistant' ? (
              <div
                key={i}
                className="openclaw-message openclaw-msg-assistant"
                dangerouslySetInnerHTML={{
                  __html: parseOpenclawMarkdown(m.text),
                }}
              />
            ) : (
              <div key={i} className="openclaw-message openclaw-msg-user">
                {m.text}
              </div>
            ),
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="openclaw-input-area">
          <textarea
            id="openclaw-input"
            ref={inputRef}
            placeholder={t('placeholder')}
            rows={1}
            value={inputValue}
            disabled={isStreaming}
            onChange={onInput}
            onKeyDown={onKeyDown}
            onFocus={restoreDialog}
            onBlur={() => {
              const root = document.querySelector('.openclaw-panel-chat');
              if (root && !root.matches(':hover')) startFadeCountdown();
            }}
          />
          <button
            type="button"
            id="openclaw-send-btn"
            disabled={isStreaming}
            onClick={() => void sendMessage()}
          >
            <SendIcon className="openclaw-send-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
