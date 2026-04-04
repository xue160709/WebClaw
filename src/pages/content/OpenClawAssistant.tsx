import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FADE,
  DEFAULT_GATEWAY,
  DEFAULT_ICON,
  DEFAULT_PROMPTS,
  STORAGE,
  normalizeLocale,
  type PromptItem,
} from '@src/lib/openclaw/constants';
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  LinkIcon,
  SendIcon,
} from '@src/components/OpenClawIcons';
import { tString, type OpenClawLocale } from '@src/lib/openclaw/i18nData';
import { parseOpenclawMarkdown } from '@src/lib/openclaw/markdown';

type Msg = { role: 'user' | 'assistant'; text: string; streamId?: string };

function getSafePosition(
  left: number,
  top: number,
  width: number,
  height: number,
) {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  return {
    left: Math.max(0, Math.min(left, ww - width)),
    top: Math.max(0, Math.min(top, wh - height)),
  };
}

export default function OpenClawAssistant() {
  const [locale, setLocale] = useState<OpenClawLocale>('zh-CN');
  const [iconStyle, setIconStyle] = useState<React.CSSProperties>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFaded, setIsFaded] = useState(false);
  const [dialogPos, setDialogPos] = useState<React.CSSProperties>({});
  const [hoverOpen, setHoverOpen] = useState(false);
  const [hoverSide, setHoverSide] = useState<'left' | 'right'>('right');
  const [hoverMenuStyle, setHoverMenuStyle] = useState<React.CSSProperties>({});
  const [hoverTitle, setHoverTitle] = useState('');
  const [hoverPrompts, setHoverPrompts] = useState<PromptItem[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const didInitWelcome = useRef(false);

  const fadeSecRef = useRef(DEFAULT_FADE);
  const gatewayRef = useRef(DEFAULT_GATEWAY);
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconContainerRef = useRef<HTMLDivElement>(null);
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
    if (!dialogOpen || isFullScreen) return;
    const ms = Math.max(1000, (fadeSecRef.current || DEFAULT_FADE) * 1000);
    fadeTimerRef.current = setTimeout(() => setIsFaded(true), ms);
  }, [clearFadeTimer, dialogOpen, isFullScreen]);

  const loadFromStorage = useCallback(() => {
    chrome.storage.local.get(
      [STORAGE.ICON_POS, STORAGE.LANGUAGE, STORAGE.GATEWAY],
      (result) => {
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
        if (result[STORAGE.ICON_POS]) {
          const pos = result[STORAGE.ICON_POS] as { left: number; top: number };
          const el = iconContainerRef.current;
          const w = el?.offsetWidth || 48;
          const h = el?.offsetHeight || 48;
          const safe = getSafePosition(pos.left, pos.top, w, h);
          setIconStyle({
            left: safe.left,
            top: safe.top,
            bottom: 'auto',
            right: 'auto',
          });
        }
      },
    );
  }, []);

  useEffect(() => {
    loadFromStorage();
    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local') return;
      if (
        changes[STORAGE.ICON_POS] ||
        changes[STORAGE.LANGUAGE] ||
        changes[STORAGE.GATEWAY]
      ) {
        loadFromStorage();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [loadFromStorage]);

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

  const positionDialog = useCallback(() => {
    const iconEl = iconContainerRef.current;
    if (!iconEl) return;
    const iconRect = iconEl.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const dialogWidth = 320;
    const dialogHeight = 400;

    const next: React.CSSProperties = {};
    if (iconRect.left > windowWidth / 2) {
      next.right = windowWidth - iconRect.left + 10;
      next.left = 'auto';
    } else {
      next.left = iconRect.right + 10;
      next.right = 'auto';
    }
    let top = iconRect.top;
    if (top + dialogHeight > windowHeight) {
      top = windowHeight - dialogHeight - 20;
    }
    next.top = Math.max(20, top);
    next.bottom = 'auto';
    setDialogPos(next);
  }, []);

  const openDialog = useCallback(() => {
    setHoverOpen(false);
    positionDialog();
    setDialogOpen(true);
    restoreDialog();
    queueMicrotask(() => inputRef.current?.focus());
  }, [positionDialog, restoreDialog]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    clearFadeTimer();
  }, [clearFadeTimer]);

  const toggleDialog = useCallback(() => {
    if (dialogOpen) closeDialog();
    else openDialog();
  }, [dialogOpen, closeDialog, openDialog]);

  const sendWithText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming) return;

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
          context: { url: window.location.href, title: document.title },
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

  const sendMessage = useCallback(() => {
    if (isStreaming) return;
    sendWithText(inputValue);
  }, [inputValue, isStreaming, sendWithText]);

  const processQuickAction = useCallback(
    (template: string, extra: { text?: string } = {}) => {
      let text = template;
      text = text.replace(/{url}/g, window.location.href);
      text = text.replace(/{text}/g, extra.text ?? '');
      text = text.replace(/{imageUrl}/g, '');
      openDialog();
      sendWithText(text);
    },
    [openDialog, sendWithText],
  );

  const refreshHoverMenu = useCallback(() => {
    const selection = window.getSelection()?.toString().trim() ?? '';
    const mode = selection ? 'Selection' : 'Page';
    setHoverTitle(
      mode === 'Selection' ? tString(locale, 'modeSelection') : tString(locale, 'modePage'),
    );
    const key =
      mode === 'Selection' ? STORAGE.SELECTION_PROMPTS : STORAGE.PAGE_PROMPTS;
    chrome.storage.local.get([key], (result) => {
      let prompts = result[key] as PromptItem[] | undefined;
      if (!prompts?.length) {
        prompts =
          mode === 'Selection' ? DEFAULT_PROMPTS.selection : DEFAULT_PROMPTS.page;
      }
      setHoverPrompts(prompts);
    });
  }, [locale]);

  const onIconMouseEnter = useCallback(() => {
    if (isDraggingRef.current) return;
    restoreDialog();
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
    if (dialogOpen) return;
    refreshHoverMenu();
    const iconRect = iconContainerRef.current?.getBoundingClientRect();
    if (!iconRect) return;
    const windowWidth = window.innerWidth;
    if (iconRect.left > windowWidth / 2) {
      setHoverSide('left');
      setHoverMenuStyle({ right: '100%', left: 'auto' });
    } else {
      setHoverSide('right');
      setHoverMenuStyle({ left: '100%', right: 'auto' });
    }
    setHoverOpen(true);
  }, [dialogOpen, refreshHoverMenu, restoreDialog]);

  const scheduleHoverHide = useCallback(() => {
    if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
    hoverHideTimerRef.current = setTimeout(() => setHoverOpen(false), 500);
  }, []);

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
      if (request.action !== 'injectText') return;
      setDialogOpen(true);
      restoreDialog();
      setInputValue(request.text ?? '');
      queueMicrotask(() => {
        const el = inputRef.current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }
        if (request.autoSend && request.text) {
          sendWithText(request.text);
        }
      });
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, [restoreDialog, sendWithText]);

  useEffect(() => {
    const icon = iconContainerRef.current?.querySelector('#openclaw-icon');
    if (!icon) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDraggingRef.current = false;
      dragStartTimeRef.current = Date.now();
      const rect = iconContainerRef.current!.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const onMove = (ev: MouseEvent) => {
        if (
          !isDraggingRef.current &&
          (Math.abs(ev.clientX - (rect.left + offsetX)) > 5 ||
            Math.abs(ev.clientY - (rect.top + offsetY)) > 5)
        ) {
          isDraggingRef.current = true;
          iconContainerRef.current?.classList.add('dragging');
          setHoverOpen(false);
        }
        if (isDraggingRef.current) {
          ev.preventDefault();
          let newLeft = ev.clientX - offsetX;
          let newTop = ev.clientY - offsetY;
          const r = iconContainerRef.current!.getBoundingClientRect();
          const safe = getSafePosition(newLeft, newTop, r.width, r.height);
          setIconStyle({
            left: safe.left,
            top: safe.top,
            bottom: 'auto',
            right: 'auto',
          });
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        iconContainerRef.current?.classList.remove('dragging');
        if (isDraggingRef.current) {
          const el = iconContainerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            void chrome.storage.local.set({
              [STORAGE.ICON_POS]: { left: rect.left, top: rect.top },
            });
            setIconStyle({
              left: rect.left,
              top: rect.top,
              bottom: 'auto',
              right: 'auto',
            });
          }
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 50);
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    const onClick = () => {
      if (isDraggingRef.current) return;
      if (Date.now() - dragStartTimeRef.current < 200) {
        toggleDialog();
        restoreDialog();
      }
    };

    icon.addEventListener('mousedown', onMouseDown);
    icon.addEventListener('click', onClick);
    return () => {
      icon.removeEventListener('mousedown', onMouseDown);
      icon.removeEventListener('click', onClick);
    };
  }, [restoreDialog, toggleDialog]);

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    if (e.target.value === '') e.target.style.height = '';
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) sendMessage();
    }
  };

  const toggleFullScreen = () => {
    if (isFullScreen) {
      setIsFullScreen(false);
      queueMicrotask(() => {
        positionDialog();
        setDialogOpen(true);
      });
      return;
    }
    setIsFullScreen(true);
    restoreDialog();
  };

  const openGatewayOrigin = () => {
    const g = gatewayRef.current;
    try {
      const url = new URL(g);
      window.open(url.origin, '_blank');
    } catch {
      window.open(g, '_blank');
    }
  };

  const dialogClass = [
    isFullScreen ? 'openclaw-fullscreen' : '',
    isFaded ? 'openclaw-faded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div id="openclaw-assistant-root">
      <div
        id="openclaw-dialog"
        className={dialogClass.trim()}
        style={{
          display: dialogOpen ? 'flex' : 'none',
          ...(isFullScreen
            ? {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
              }
            : dialogPos),
        }}
        onMouseEnter={restoreDialog}
        onMouseLeave={() => {
          if (document.activeElement === inputRef.current) return;
          startFadeCountdown();
        }}
      >
        <div className="openclaw-header">
          <span className="openclaw-title">
            {t('assistantName')}
          </span>
          <div className="openclaw-controls">
            <button
              type="button"
              className="openclaw-btn-icon"
              title={t('fullScreen')}
              onClick={toggleFullScreen}
            >
              {isFullScreen ? (
                <CollapseIcon className="openclaw-icon-svg" />
              ) : (
                <ExpandIcon className="openclaw-icon-svg" />
              )}
            </button>
            <button
              type="button"
              className="openclaw-btn-icon"
              title="OpenClaw Chat"
              onClick={openGatewayOrigin}
            >
              <LinkIcon className="openclaw-icon-svg" />
            </button>
            <button
              type="button"
              className="openclaw-btn-icon"
              title={t('close')}
              onClick={closeDialog}
            >
              <CloseIcon className="openclaw-icon-svg" />
            </button>
          </div>
        </div>
        <div className="openclaw-messages" id="openclaw-messages">
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
              const dialog = document.getElementById('openclaw-dialog');
              if (dialog && !dialog.matches(':hover')) startFadeCountdown();
            }}
          />
          <button
            type="button"
            id="openclaw-send-btn"
            disabled={isStreaming}
            onClick={sendMessage}
          >
            <SendIcon className="openclaw-send-icon" />
          </button>
        </div>
      </div>

      <div
        ref={iconContainerRef}
        id="openclaw-icon-container"
        style={iconStyle}
        onMouseEnter={onIconMouseEnter}
        onMouseLeave={scheduleHoverHide}
      >
        <div
          id="openclaw-hover-menu"
          className={hoverSide}
          style={{
            display: hoverOpen ? 'flex' : 'none',
            ...hoverMenuStyle,
          }}
          onMouseEnter={() => {
            if (hoverHideTimerRef.current) {
              clearTimeout(hoverHideTimerRef.current);
              hoverHideTimerRef.current = null;
            }
            setHoverOpen(true);
          }}
          onMouseLeave={scheduleHoverHide}
        >
          <div className="openclaw-hover-title">{hoverTitle}</div>
          {hoverPrompts.map((p, idx) => (
            <div
              key={idx}
              className="openclaw-hover-item"
              title={p.prompt}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                const selection = window.getSelection()?.toString().trim() ?? '';
                processQuickAction(p.prompt, { text: selection });
                setHoverOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const selection =
                    window.getSelection()?.toString().trim() ?? '';
                  processQuickAction(p.prompt, { text: selection });
                  setHoverOpen(false);
                }
              }}
            >
              {p.label}
            </div>
          ))}
        </div>
        <div id="openclaw-icon" title="OpenClaw Assistant">
          {DEFAULT_ICON}
        </div>
      </div>
    </div>
  );
}
