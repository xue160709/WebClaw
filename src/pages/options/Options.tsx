import React, { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GATEWAY,
  DEFAULT_PROMPTS,
  // DEFAULT_SESSION,
  STORAGE,
  normalizeLocale,
  type PromptItem,
} from '@src/lib/openclaw/constants';
import { OPENCLAW_I18N, type OpenClawLocale } from '@src/lib/openclaw/i18nData';

function migratePrompts(
  arr: PromptItem[] | undefined,
  legacy: string | undefined,
  fallback: PromptItem[],
): PromptItem[] {
  if (arr?.length) return arr;
  if (legacy?.trim()) return [{ label: 'Custom', prompt: legacy.trim() }];
  return fallback;
}

const sectionClass =
  'rounded-openclaw-card border border-openclaw-border bg-openclaw-surface p-6 shadow-openclaw';
const inputClass =
  'w-full rounded-openclaw-input border border-openclaw-border bg-openclaw-soft px-4 py-3 text-sm text-openclaw-text outline-none transition focus:border-openclaw-primary focus:ring-4 focus:ring-openclaw-primary/15';
const labelClass = 'mb-2 block text-sm font-medium text-openclaw-text';
const pillButtonClass =
  'inline-flex items-center justify-center rounded-openclaw-pill px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-openclaw-primary/20';
const iconButtonClass =
  'inline-flex h-9 items-center justify-center rounded-openclaw-pill border border-openclaw-border bg-openclaw-surface px-3 text-sm font-medium text-openclaw-text transition hover:border-openclaw-border-strong hover:bg-openclaw-soft focus:outline-none focus:ring-4 focus:ring-openclaw-primary/15';

export default function Options() {
  const [locale, setLocale] = useState<OpenClawLocale>('zh-CN');
  const [gateway, setGateway] = useState(DEFAULT_GATEWAY);
  const [token, setToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  // const [sessionKey, setSessionKey] = useState(DEFAULT_SESSION);
  const [pagePrompts, setPagePrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.page,
  );
  const [selectionPrompts, setSelectionPrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.selection,
  );
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  const t = useCallback(
    (key: string) => OPENCLAW_I18N[locale][key] ?? OPENCLAW_I18N.en[key] ?? key,
    [locale],
  );

  useEffect(() => {
    chrome.storage.local.get(
      [
        STORAGE.GATEWAY,
        STORAGE.TOKEN,
        // STORAGE.SESSION_KEY,
        STORAGE.LANGUAGE,
        STORAGE.PAGE_PROMPTS,
        STORAGE.SELECTION_PROMPTS,
        STORAGE.LEGACY_PAGE,
        STORAGE.LEGACY_SELECTION,
      ],
      (r) => {
        setGateway((r[STORAGE.GATEWAY] as string) || DEFAULT_GATEWAY);
        setToken((r[STORAGE.TOKEN] as string) || '');
        // setSessionKey((r[STORAGE.SESSION_KEY] as string) || DEFAULT_SESSION);
        setLocale(normalizeLocale(r[STORAGE.LANGUAGE] as string | undefined));
        setPagePrompts(
          migratePrompts(
            r[STORAGE.PAGE_PROMPTS] as PromptItem[],
            r[STORAGE.LEGACY_PAGE] as string,
            DEFAULT_PROMPTS.page,
          ),
        );
        setSelectionPrompts(
          migratePrompts(
            r[STORAGE.SELECTION_PROMPTS] as PromptItem[],
            r[STORAGE.LEGACY_SELECTION] as string,
            DEFAULT_PROMPTS.selection,
          ),
        );
      },
    );
  }, []);

  const showStatus = (text: string, error = false) => {
    setStatus({ text, error });
    setTimeout(() => setStatus(null), 3000);
  };

  const save = () => {
    const tok = token.trim();
    if (!tok) {
      showStatus(t('statusError'), true);
      return;
    }
    const settings: Record<string, unknown> = {
      [STORAGE.GATEWAY]: gateway.trim(),
      [STORAGE.TOKEN]: tok,
      // [STORAGE.SESSION_KEY]: sessionKey.trim(),
      [STORAGE.LANGUAGE]: locale,
      [STORAGE.PAGE_PROMPTS]: pagePrompts.filter(
        (p) => p.label.trim() && p.prompt.trim(),
      ),
      [STORAGE.SELECTION_PROMPTS]: selectionPrompts.filter(
        (p) => p.label.trim() && p.prompt.trim(),
      ),
    };
    chrome.storage.local.set(settings, () => {
      showStatus(t('statusSaved'));
    });
  };

  const updatePrompt = (
    list: PromptItem[],
    setList: (p: PromptItem[]) => void,
    index: number,
    field: 'label' | 'prompt',
    value: string,
  ) => {
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    setList(next);
  };

  const removePrompt = (
    list: PromptItem[],
    setList: (p: PromptItem[]) => void,
    index: number,
  ) => {
    setList(list.filter((_, i) => i !== index));
  };

  const promptBlock = (
    title: string,
    list: PromptItem[],
    setList: (p: PromptItem[]) => void,
  ) => (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-openclaw-text">{title}</h3>
          <p className="mt-1 text-sm text-openclaw-muted">
            {t('quickOptionHelp')}
          </p>
        </div>
        <button
          type="button"
          className={`${pillButtonClass} bg-openclaw-primary px-4 text-white hover:bg-openclaw-primary-strong`}
          onClick={() => setList([...list, { label: '', prompt: '' }])}
        >
          {t('addPrompt')}
        </button>
      </div>
      <div className="space-y-4">
        {list.map((p, i) => (
          <div
            key={i}
            className="rounded-openclaw-card border border-openclaw-border bg-openclaw-surface p-4 shadow-openclaw"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-openclaw-text">
                  {title}
                </div>
                <div className="mt-1 text-xs text-openclaw-muted">
                  {t('promptLabel')} #{i + 1}
                </div>
              </div>
              <button
                type="button"
                className={`${pillButtonClass} bg-red-50 px-3 text-red-600 hover:bg-red-100 focus:ring-red-200`}
                onClick={() => removePrompt(list, setList, i)}
              >
                {t('removePrompt')}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="min-w-0">
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-openclaw-muted">
                  {t('promptLabel')}
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder={t('promptLabel')}
                  value={p.label}
                  onChange={(e) =>
                    updatePrompt(list, setList, i, 'label', e.target.value)
                  }
                />
              </div>
              <div className="min-w-0">
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-openclaw-muted">
                  {t('promptContent')}
                </label>
                <textarea
                  className={`${inputClass} min-h-28 resize-y`}
                  placeholder={t('promptContent')}
                  rows={4}
                  value={p.prompt}
                  onChange={(e) =>
                    updatePrompt(list, setList, i, 'prompt', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="relative min-h-screen bg-openclaw-bg px-4 py-8 text-openclaw-text md:px-6">
      {status ? (
        <div
          className={`fixed right-5 top-5 z-50 rounded-openclaw-pill px-4 py-2 text-sm font-medium text-white shadow-openclaw ${
            status.error ? 'bg-red-500' : 'bg-openclaw-primary'
          }`}
        >
          {status.text}
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-6">
        <section className={`${sectionClass} overflow-hidden`}>
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-openclaw-pill bg-openclaw-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-openclaw-primary-strong">
                OpenClaw
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-openclaw-text">
                {t('settingsTitle')}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-openclaw-muted">
                统一你的助手入口、快捷操作与对话体验。整体为灰底白卡片布局，主操作按钮使用橙色强调。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-openclaw-pill border border-openclaw-border bg-openclaw-soft px-4 py-2 text-sm text-openclaw-muted">
                Gateway / Token
              </div>
              <div className="rounded-openclaw-pill border border-openclaw-border bg-openclaw-soft px-4 py-2 text-sm text-openclaw-muted">
                Prompt presets
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-openclaw-text">
                {t('generalSettings')}
              </h2>
              <p className="mt-1 text-sm text-openclaw-muted">
                配置网关、身份信息与交互行为。
              </p>
            </div>
            <button
              type="button"
              className={`${pillButtonClass} bg-openclaw-primary px-5 text-white hover:bg-openclaw-primary-strong`}
              onClick={save}
            >
              {t('saveBtn')}
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="gw">
                {t('gatewayLabel')}
              </label>
              <input
                id="gw"
                type="text"
                className={inputClass}
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="tok">
                {t('tokenLabel')}
              </label>
              <div className="relative">
                <input
                  id="tok"
                  type={tokenVisible ? 'text' : 'password'}
                  autoComplete="off"
                  className={`${inputClass} pr-12`}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-openclaw-pill p-2 text-openclaw-muted transition hover:bg-openclaw-soft hover:text-openclaw-text focus:outline-none focus:ring-2 focus:ring-openclaw-primary/25"
                  onClick={() => setTokenVisible((v) => !v)}
                  aria-label={tokenVisible ? t('tokenHide') : t('tokenShow')}
                  title={tokenVisible ? t('tokenHide') : t('tokenShow')}
                >
                  {tokenVisible ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.638 0 8.573 3.007 9.963 7.178.073.227.073.442 0 .615M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 默认 Session Key — 暂时注释
            <div>
              <label className={labelClass} htmlFor="sess">
                {t('sessionKeyLabel')}
              </label>
              <input
                id="sess"
                type="text"
                className={inputClass}
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
              />
            </div>
            */}

            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="lang">
                {t('languageLabel')}
              </label>
              <select
                id="lang"
                className={inputClass}
                value={locale}
                onChange={(e) => setLocale(e.target.value as OpenClawLocale)}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-openclaw-text">
                {t('quickOptions')}
              </h2>
              <p className="mt-1 text-sm text-openclaw-muted">
                通过预设 prompt 统一整页与框选两种工作流。
              </p>
            </div>
            <div className={iconButtonClass}>Use variables: {'{url}'} {'{text}'}</div>
          </div>

          <div className="grid gap-6">
            <div className={sectionClass}>
              {promptBlock(t('modePage'), pagePrompts, setPagePrompts)}
            </div>
            <div className={sectionClass}>
              {promptBlock(t('modeSelection'), selectionPrompts, setSelectionPrompts)}
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            className={`${pillButtonClass} bg-openclaw-primary px-6 py-3 text-base text-white shadow-openclaw hover:bg-openclaw-primary-strong`}
            onClick={save}
          >
            {t('saveBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
