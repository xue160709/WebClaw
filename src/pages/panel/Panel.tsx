import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GATEWAY,
  DEFAULT_PROMPTS,
  STORAGE,
  normalizeLocale,
  type PromptItem,
} from '@src/lib/openclaw/constants';
import {
  ClearChatIcon,
  SendIcon,
  SettingsIcon,
} from '@src/components/OpenClawIcons';
import { tString, type OpenClawLocale } from '@src/lib/openclaw/i18nData';
import {
  composeUserMessageWithContext,
  type ContextMode,
} from '@src/lib/openclaw/composeUserMessageWithContext';
import {
  OPENCLAW_ACTIVE_TAB_CONTEXT,
  OPENCLAW_REQUEST_ACTIVE_TAB_CONTEXT,
  OPENCLAW_SELECTION_SYNC,
  type ActiveTabContextMessage,
  type SelectionSyncMessage,
} from '@src/lib/openclaw/pageContextMessages';
import { parseOpenclawMarkdown } from '@src/lib/openclaw/markdown';
import {
  buildPanelSessionKey,
  deletePanelChatRecord,
  getPanelChatRecord,
  newPanelThreadId,
  normalizePageUrlForChat,
  panelMessagesToStored,
  putPanelChatRecord,
  type PanelChatContextState,
} from '@src/lib/openclaw/panelChatStore';
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
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
  },
) {
  const { text, autoSend } = pending;
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

function normalizePanelContextState(
  state?: PanelChatContextState,
): PanelChatContextState {
  const pageArticle = state?.pageArticle?.trim();
  return {
    pageArticle: pageArticle || undefined,
    articleInjected: state?.articleInjected === true,
    fullInjected: state?.fullInjected === true,
  };
}

export default function Panel() {
  const [locale, setLocale] = useState<OpenClawLocale>('zh-CN');
  const [pagePrompts, setPagePrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.page,
  );
  const [selectionPrompts, setSelectionPrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.selection,
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [panelChatReady, setPanelChatReady] = useState(false);

  const [pageContext, setPageContext] = useState<{
    title: string;
    url: string;
    articleText: string;
    fullText: string;
    error?: string;
  }>({ title: '', url: '', articleText: '', fullText: '' });
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const activeTabIdRef = useRef<number | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [contextMode, setContextMode] = useState<ContextMode>('article');

  const gatewayRef = useRef(DEFAULT_GATEWAY);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const windowIdRef = useRef<number | null>(null);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [layoutOffsets, setLayoutOffsets] = useState({
    headerHeight: 0,
    composerHeight: 0,
  });

  const urlKeyRef = useRef(normalizePageUrlForChat(''));
  urlKeyRef.current = normalizePageUrlForChat(pageContext.url);

  const urlLoadGenRef = useRef(0);
  const panelChatSessionRef = useRef({ threadId: '', sessionKey: '' });
  const panelContextStateRef = useRef<PanelChatContextState>({});
  const streamUrlKeyRef = useRef('');
  const streamPersistRef = useRef({
    urlKey: '',
    threadId: '',
    sessionKey: '',
    pageArticle: undefined as string | undefined,
    articleInjected: false,
    fullInjected: false,
  });

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const t = useCallback((key: string) => tString(locale, key), [locale]);

  const persistPanelSnapshotForStream = useCallback((msgs: Msg[]) => {
    const {
      urlKey,
      threadId,
      sessionKey,
      pageArticle,
      articleInjected,
      fullInjected,
    } = streamPersistRef.current;
    if (!urlKey || !threadId || !sessionKey) return;
    void putPanelChatRecord({
      urlKey,
      threadId,
      sessionKey,
      pageArticle,
      articleInjected,
      fullInjected,
      messages: panelMessagesToStored(msgs),
      updatedAt: Date.now(),
    });
  }, []);

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
    });
    loadPromptsFromStorage();
  }, [loadPromptsFromStorage]);

  useEffect(() => {
    const urlKey = normalizePageUrlForChat(pageContext.url);
    const gen = ++urlLoadGenRef.current;
    setPanelChatReady(false);
    setIsStreaming(false);
    void (async () => {
      try {
        const rec = await getPanelChatRecord(urlKey);
        if (gen !== urlLoadGenRef.current) return;
        const welcomeText = tString(localeRef.current, 'defaultWelcome');
        if (rec) {
          panelContextStateRef.current = normalizePanelContextState(rec);
          const sessionKey = await buildPanelSessionKey(urlKey, rec.threadId);
          panelChatSessionRef.current = { threadId: rec.threadId, sessionKey };
          setMessages(rec.messages as Msg[]);
          if (rec.sessionKey !== sessionKey) {
            await putPanelChatRecord({
              ...rec,
              sessionKey,
              updatedAt: Date.now(),
            });
          }
        } else {
          panelContextStateRef.current = {};
          const threadId = newPanelThreadId();
          const sessionKey = await buildPanelSessionKey(urlKey, threadId);
          panelChatSessionRef.current = { threadId, sessionKey };
          const welcome: Msg[] = [{ role: 'assistant', text: welcomeText }];
          setMessages(welcome);
          await putPanelChatRecord({
            urlKey,
            threadId,
            sessionKey,
            messages: panelMessagesToStored(welcome),
            updatedAt: Date.now(),
          });
        }
        if (gen === urlLoadGenRef.current) setPanelChatReady(true);
      } catch (e) {
        console.error('OpenClaw panel chat load failed:', e);
        if (gen !== urlLoadGenRef.current) return;
        const welcomeText = tString(localeRef.current, 'defaultWelcome');
        try {
          panelContextStateRef.current = {};
          const threadId = newPanelThreadId();
          const sessionKey = await buildPanelSessionKey(urlKey, threadId);
          panelChatSessionRef.current = { threadId, sessionKey };
          const welcome: Msg[] = [{ role: 'assistant', text: welcomeText }];
          setMessages(welcome);
          await putPanelChatRecord({
            urlKey,
            threadId,
            sessionKey,
            messages: panelMessagesToStored(welcome),
            updatedAt: Date.now(),
          });
        } catch {
          panelContextStateRef.current = {};
          panelChatSessionRef.current = { threadId: '', sessionKey: '' };
          setMessages([{ role: 'assistant', text: welcomeText }]);
        }
        if (gen === urlLoadGenRef.current) setPanelChatReady(true);
      }
    })();
  }, [pageContext.url]);

  useEffect(() => {
    chrome.windows.getCurrent((w) => {
      windowIdRef.current = w.id ?? null;
      void chrome.runtime.sendMessage({
        action: OPENCLAW_REQUEST_ACTIVE_TAB_CONTEXT,
      });
    });
  }, []);

  useEffect(() => {
    const onCtx = (request: unknown) => {
      const r = request as { action?: string };
      if (
        r?.action !== OPENCLAW_ACTIVE_TAB_CONTEXT &&
        r?.action !== OPENCLAW_SELECTION_SYNC
      ) {
        return;
      }
      if (r?.action === OPENCLAW_ACTIVE_TAB_CONTEXT) {
        const m = request as ActiveTabContextMessage;
        if (windowIdRef.current === null) windowIdRef.current = m.windowId;
        else if (m.windowId !== windowIdRef.current) return;

        const prevTabId = activeTabIdRef.current;
        const tabChanged = prevTabId !== null && prevTabId !== m.tabId;
        activeTabIdRef.current = m.tabId;
        setActiveTabId(m.tabId);
        setPageContext({
          title: m.title,
          url: m.url,
          articleText: m.articleText,
          fullText: m.fullText,
          error: m.error,
        });
        if (tabChanged) {
          setSelectionText('');
          setContextMode('article');
        }
        return;
      }
      if (r?.action === OPENCLAW_SELECTION_SYNC) {
        const m = request as SelectionSyncMessage;
        if (
          windowIdRef.current !== null &&
          m.windowId !== windowIdRef.current
        ) {
          return;
        }

        const applySelection = (raw: string) => {
          const text = raw.trim();
          setSelectionText(text);
          if (text) setContextMode('selection');
          else setContextMode((mode) => (mode === 'selection' ? 'article' : mode));
        };

        void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) return;
          const activeId = tabs[0]?.id;
          if (activeId !== m.tabId) return;
          if (windowIdRef.current === null) windowIdRef.current = m.windowId;
          if (activeTabIdRef.current !== m.tabId) {
            activeTabIdRef.current = m.tabId;
            setActiveTabId(m.tabId);
          }
          applySelection(m.text);
        });
      }
    };
    chrome.runtime.onMessage.addListener(onCtx);
    return () => chrome.runtime.onMessage.removeListener(onCtx);
  }, []);

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
            inputRef,
          });
          void chrome.storage.local.remove(STORAGE.PENDING_PANEL_INJECT);
        }
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [loadFromStorage]);

  const sendWithTextRef = useRef<(raw: string) => void>((_raw) => {});

  useEffect(() => {
    if (!panelChatReady) return;
    const knownWelcomes = new Set(
      (['en', 'zh-CN'] as const).map((l) => tString(l, 'defaultWelcome')),
    );
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant' && !prev[0].streamId) {
        if (!knownWelcomes.has(prev[0].text)) return prev;
        const w = tString(locale, 'defaultWelcome');
        if (prev[0].text === w) return prev;
        const next: Msg[] = [{ role: 'assistant', text: w }];
        queueMicrotask(() => {
          const urlKey = urlKeyRef.current;
          const { threadId, sessionKey } = panelChatSessionRef.current;
          if (!threadId || !sessionKey) return;
          void putPanelChatRecord({
            urlKey,
            threadId,
            sessionKey,
            ...panelContextStateRef.current,
            messages: panelMessagesToStored(next),
            updatedAt: Date.now(),
          });
        });
        return next;
      }
      return prev;
    });
  }, [locale, panelChatReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    const headerEl = headerRef.current;
    const composerEl = composerRef.current;
    if (!headerEl && !composerEl) return;

    const updateLayoutOffsets = () => {
      const next = {
        headerHeight: headerEl?.offsetHeight ?? 0,
        composerHeight: composerEl?.offsetHeight ?? 0,
      };
      setLayoutOffsets((prev) =>
        prev.headerHeight === next.headerHeight &&
        prev.composerHeight === next.composerHeight
          ? prev
          : next,
      );
    };

    updateLayoutOffsets();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateLayoutOffsets);
    if (headerEl) observer?.observe(headerEl);
    if (composerEl) observer?.observe(composerEl);
    window.addEventListener('resize', updateLayoutOffsets);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateLayoutOffsets);
    };
  }, []);

  const clearChatHistory = useCallback(async () => {
    if (isStreaming || !panelChatReady) return;
    const urlKey = urlKeyRef.current;
    try {
      await deletePanelChatRecord(urlKey);
    } catch (e) {
      console.error('OpenClaw panel chat delete failed:', e);
    }
    const threadId = newPanelThreadId();
    const sessionKey = await buildPanelSessionKey(urlKey, threadId);
    panelContextStateRef.current = {};
    panelChatSessionRef.current = { threadId, sessionKey };
    const welcome: Msg[] = [
      { role: 'assistant', text: tString(localeRef.current, 'defaultWelcome') },
    ];
    setMessages(welcome);
    try {
      await putPanelChatRecord({
        urlKey,
        threadId,
        sessionKey,
        ...panelContextStateRef.current,
        messages: panelMessagesToStored(welcome),
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error('OpenClaw panel chat save failed:', e);
    }
  }, [isStreaming, panelChatReady]);

  const sendWithText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming || !panelChatReady) return;

      const tab = await getActiveTab();
      const tabId = tab?.id;
      const requestId = crypto.randomUUID();
      const sendUrlKey = urlKeyRef.current;
      streamUrlKeyRef.current = sendUrlKey;
      streamPersistRef.current = {
        urlKey: sendUrlKey,
        threadId: panelChatSessionRef.current.threadId,
        sessionKey: panelChatSessionRef.current.sessionKey,
        pageArticle: panelContextStateRef.current.pageArticle,
        articleInjected: panelContextStateRef.current.articleInjected === true,
        fullInjected: panelContextStateRef.current.fullInjected === true,
      };

      const currentContextState = normalizePanelContextState(panelContextStateRef.current);
      const nextContextState = normalizePanelContextState({
        ...currentContextState,
        pageArticle: currentContextState.pageArticle ?? pageContext.articleText,
      });
      const snapshot = {
        title: pageContext.title,
        url: pageContext.url,
        articleText: nextContextState.pageArticle ?? '',
        fullText: pageContext.fullText,
        selectionText,
      };

      let apiText = text;

      if (contextMode === 'selection') {
        apiText = composeUserMessageWithContext(
          text,
          'selection',
          snapshot,
          locale,
        ).text;
      } else if (contextMode === 'article') {
        if (!nextContextState.articleInjected) {
          const composed = composeUserMessageWithContext(
            text,
            'article',
            snapshot,
            locale,
          );
          apiText = composed.text;
          if (composed.text !== text) {
            nextContextState.articleInjected = true;
          }
        }
      } else if (!nextContextState.fullInjected) {
        const composed = composeUserMessageWithContext(text, 'full', snapshot, locale);
        apiText = composed.text;
        if (composed.text !== text) {
          nextContextState.fullInjected = true;
        }
      }

      panelContextStateRef.current = nextContextState;
      streamPersistRef.current = {
        ...streamPersistRef.current,
        pageArticle: nextContextState.pageArticle,
        articleInjected: nextContextState.articleInjected === true,
        fullInjected: nextContextState.fullInjected === true,
      };

      const nextMessages: Msg[] = [
        ...messages,
        { role: 'user', text },
        { role: 'assistant', text: '', streamId: requestId },
      ];

      setMessages(nextMessages);
      setInputValue('');
      setIsStreaming(true);

      try {
        await putPanelChatRecord({
          urlKey: sendUrlKey,
          threadId: panelChatSessionRef.current.threadId,
          sessionKey: panelChatSessionRef.current.sessionKey,
          ...nextContextState,
          messages: panelMessagesToStored(nextMessages),
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.error('OpenClaw panel chat pre-send save failed:', e);
      }

      const sessionKey = panelChatSessionRef.current.sessionKey;

      chrome.runtime.sendMessage(
        {
          action: 'sendMessage',
          text: apiText,
          requestId,
          tabId,
          sessionKey,
          context: { url: tab?.url ?? '', title: tab?.title ?? '' },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setIsStreaming(false);
            const err = chrome.runtime.lastError.message;
            setMessages((prev) => {
              if (streamUrlKeyRef.current !== urlKeyRef.current) return prev;
              const next: Msg[] = prev.map((m) =>
                m.streamId === requestId
                  ? { role: 'assistant' as const, text: 'Error: ' + err }
                  : m,
              );
              queueMicrotask(() => persistPanelSnapshotForStream(next));
              return next;
            });
            return;
          }
          if (response?.streaming) {
            return;
          }
          setIsStreaming(false);
          if (response?.success && typeof response.data === 'string') {
            setMessages((prev) => {
              if (streamUrlKeyRef.current !== urlKeyRef.current) return prev;
              const next: Msg[] = prev.map((m) =>
                m.streamId === requestId
                  ? { role: 'assistant' as const, text: response.data }
                  : m,
              );
              queueMicrotask(() => persistPanelSnapshotForStream(next));
              return next;
            });
          } else {
            setMessages((prev) => {
              if (streamUrlKeyRef.current !== urlKeyRef.current) return prev;
              const next: Msg[] = prev.map((m) =>
                m.streamId === requestId
                  ? {
                      role: 'assistant' as const,
                      text: 'Error: ' + (response?.error ?? 'Unknown error'),
                    }
                  : m,
              );
              queueMicrotask(() => persistPanelSnapshotForStream(next));
              return next;
            });
          }
        },
      );
    },
    [
      contextMode,
      isStreaming,
      locale,
      messages,
      pageContext,
      panelChatReady,
      persistPanelSnapshotForStream,
      selectionText,
    ],
  );

  sendWithTextRef.current = sendWithText;

  const sendMessage = useCallback(() => {
    if (isStreaming || !panelChatReady) return;
    void sendWithText(inputValue);
  }, [inputValue, isStreaming, panelChatReady, sendWithText]);

  const processQuickAction = useCallback(
    async (template: string, extra: { text?: string } = {}) => {
      const tab = await getActiveTab();
      let text = template;
      text = text.replace(/{url}/g, tab?.url ?? '');
      text = text.replace(/{text}/g, extra.text ?? '');
      text = text.replace(/{imageUrl}/g, '');
      void sendWithText(text);
    },
    [sendWithText],
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
          inputRef,
        });
        void chrome.storage.local.remove(STORAGE.PENDING_PANEL_INJECT);
      }
    });
  }, []);

  useEffect(() => {
    const onMsg = (request: {
      action?: string;
      text?: string;
      autoSend?: boolean;
      requestId?: string;
      delta?: string;
      error?: string;
      windowId?: number;
      tabId?: number;
    }) => {
      if (
        request.action === OPENCLAW_ACTIVE_TAB_CONTEXT ||
        request.action === OPENCLAW_SELECTION_SYNC
      ) {
        return;
      }
      if (
        request.action === 'streamDelta' &&
        request.requestId &&
        typeof request.delta === 'string'
      ) {
        if (streamUrlKeyRef.current !== urlKeyRef.current) return;
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
        setMessages((prev) => {
          if (streamUrlKeyRef.current !== urlKeyRef.current) return prev;
          const next: Msg[] = prev.map((m) =>
            m.streamId === request.requestId
              ? { role: m.role, text: m.text }
              : m,
          );
          queueMicrotask(() => persistPanelSnapshotForStream(next));
          return next;
        });
        setIsStreaming(false);
        return;
      }
      if (request.action === 'streamError' && request.requestId) {
        setMessages((prev) => {
          if (streamUrlKeyRef.current !== urlKeyRef.current) return prev;
          const next: Msg[] = prev.map((m) =>
            m.streamId === request.requestId
              ? {
                  role: 'assistant' as const,
                  text: 'Error: ' + (request.error ?? 'Unknown error'),
                }
              : m,
          );
          queueMicrotask(() => persistPanelSnapshotForStream(next));
          return next;
        });
        setIsStreaming(false);
        return;
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, [persistPanelSnapshotForStream]);

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    if (e.target.value === '') e.target.style.height = '';
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && panelChatReady) void sendMessage();
    }
  };

  const openSettings = () => {
    void chrome.runtime.sendMessage({ action: 'openOptions' });
  };

  const quickBtn = (p: PromptItem, run: () => void) => (
    <button
      key={p.label + p.prompt.slice(0, 12)}
      type="button"
      className="openclaw-panel-quick-btn"
      title={p.prompt}
      onClick={() => {
        void run();
      }}
    >
      {p.label}
    </button>
  );

  const panelLayoutStyle = {
    '--openclaw-panel-header-height': `${layoutOffsets.headerHeight}px`,
    '--openclaw-panel-composer-height': `${layoutOffsets.composerHeight}px`,
  } as React.CSSProperties;

  return (
    <div className="openclaw-panel-root" style={panelLayoutStyle}>
      <div ref={headerRef} className="openclaw-panel-header">
        <div className="openclaw-panel-header-main">
          {pageContext.title ? (
            <span
              className="openclaw-page-title"
              title={pageContext.url || undefined}
            >
              {pageContext.title}
            </span>
          ) : pageContext.error ? (
            <span className="openclaw-page-title openclaw-page-title-muted">
              {t('pageUnreadable')}
            </span>
          ) : null}
        </div>
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

      <div className="openclaw-panel-chat">
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
        <div ref={composerRef} className="openclaw-panel-composer">
          <div className="openclaw-input-quick">
            <div className="openclaw-panel-quick-title">
              {contextMode === 'selection' ? t('modeSelection') : t('modePage')}
            </div>
            <div className="openclaw-panel-quick-btns">
              {contextMode === 'selection'
                ? selectionPrompts.map((p) =>
                    quickBtn(p, async () => {
                      const sel = (await getSelectionFromActiveTab()).trim();
                      void processQuickAction(p.prompt, { text: sel });
                    }),
                  )
                : pagePrompts.map((p) =>
                    quickBtn(p, () => void processQuickAction(p.prompt)),
                  )}
            </div>
          </div>
          <div className="openclaw-input-area">
            <select
              className="openclaw-context-select"
              value={contextMode}
              onChange={(e) => setContextMode(e.target.value as ContextMode)}
              disabled={isStreaming || !panelChatReady}
              aria-label={t('contextType')}
              title={t('contextType')}
            >
              <option value="article">{t('contextArticle')}</option>
              <option value="full">{t('contextFullPage')}</option>
              {selectionText.trim() ? (
                <option value="selection">{t('contextSelection')}</option>
              ) : null}
            </select>
            <textarea
              id="openclaw-input"
              ref={inputRef}
              placeholder={t('placeholder')}
              rows={1}
              value={inputValue}
              disabled={isStreaming || !panelChatReady}
              onChange={onInput}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="openclaw-panel-clear-history-btn"
              disabled={isStreaming || !panelChatReady}
              aria-label={t('clearChatHistory')}
              title={t('clearChatHistory')}
              onClick={() => void clearChatHistory()}
            >
              <ClearChatIcon className="openclaw-icon-svg" />
            </button>
            <button
              type="button"
              id="openclaw-send-btn"
              disabled={isStreaming || !panelChatReady}
              onClick={() => void sendMessage()}
            >
              <SendIcon className="openclaw-send-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
