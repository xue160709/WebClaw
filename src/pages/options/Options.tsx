import React, { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_FADE,
  DEFAULT_GATEWAY,
  DEFAULT_ICON,
  DEFAULT_PROMPTS,
  DEFAULT_SESSION,
  STORAGE,
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

export default function Options() {
  const [locale, setLocale] = useState<OpenClawLocale>('zh-TW');
  const [gateway, setGateway] = useState(DEFAULT_GATEWAY);
  const [token, setToken] = useState('');
  const [sessionKey, setSessionKey] = useState(DEFAULT_SESSION);
  const [customIcon, setCustomIcon] = useState(DEFAULT_ICON);
  const [fadeTime, setFadeTime] = useState(String(DEFAULT_FADE));
  const [pagePrompts, setPagePrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.page,
  );
  const [selectionPrompts, setSelectionPrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.selection,
  );
  const [imagePrompts, setImagePrompts] = useState<PromptItem[]>(
    DEFAULT_PROMPTS.image,
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
        STORAGE.SESSION_KEY,
        STORAGE.CUSTOM_ICON,
        STORAGE.LANGUAGE,
        STORAGE.FADE_TIME,
        STORAGE.PAGE_PROMPTS,
        STORAGE.SELECTION_PROMPTS,
        STORAGE.IMAGE_PROMPTS,
        STORAGE.LEGACY_PAGE,
        STORAGE.LEGACY_SELECTION,
        STORAGE.LEGACY_IMAGE,
      ],
      (r) => {
        setGateway((r[STORAGE.GATEWAY] as string) || DEFAULT_GATEWAY);
        setToken((r[STORAGE.TOKEN] as string) || '');
        setSessionKey((r[STORAGE.SESSION_KEY] as string) || DEFAULT_SESSION);
        setCustomIcon((r[STORAGE.CUSTOM_ICON] as string) || DEFAULT_ICON);
        const lang = (r[STORAGE.LANGUAGE] as OpenClawLocale) || 'zh-TW';
        setLocale(lang === 'en' ? 'en' : 'zh-TW');
        setFadeTime(String(r[STORAGE.FADE_TIME] ?? DEFAULT_FADE));
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
        setImagePrompts(
          migratePrompts(
            r[STORAGE.IMAGE_PROMPTS] as PromptItem[],
            r[STORAGE.LEGACY_IMAGE] as string,
            DEFAULT_PROMPTS.image,
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
      [STORAGE.SESSION_KEY]: sessionKey.trim(),
      [STORAGE.CUSTOM_ICON]: customIcon.trim() || DEFAULT_ICON,
      [STORAGE.LANGUAGE]: locale,
      [STORAGE.FADE_TIME]: parseInt(fadeTime, 10) || DEFAULT_FADE,
      [STORAGE.PAGE_PROMPTS]: pagePrompts.filter(
        (p) => p.label.trim() && p.prompt.trim(),
      ),
      [STORAGE.SELECTION_PROMPTS]: selectionPrompts.filter(
        (p) => p.label.trim() && p.prompt.trim(),
      ),
      [STORAGE.IMAGE_PROMPTS]: imagePrompts.filter(
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
    <section className="mb-8">
      <h3 className="mb-3 border-b border-zinc-200 pb-2 text-lg font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-100">
        {title}
      </h3>
      <div className="space-y-3">
        {list.map((p, i) => (
          <div
            key={i}
            className="flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800/50"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <input
                type="text"
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-500 dark:bg-zinc-900"
                placeholder={t('promptLabel')}
                value={p.label}
                onChange={(e) =>
                  updatePrompt(list, setList, i, 'label', e.target.value)
                }
              />
              <textarea
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-500 dark:bg-zinc-900"
                placeholder={t('promptContent')}
                rows={2}
                value={p.prompt}
                onChange={(e) =>
                  updatePrompt(list, setList, i, 'prompt', e.target.value)
                }
              />
            </div>
            <button
              type="button"
              className="h-fit shrink-0 rounded bg-red-500 px-2 py-1 text-sm text-white hover:bg-red-600"
              onClick={() => removePrompt(list, setList, i)}
            >
              {t('removePrompt')}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
        onClick={() => setList([...list, { label: '', prompt: '' }])}
      >
        {t('addPrompt')}
      </button>
    </section>
  );

  return (
    <div className="relative min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {status ? (
        <div
          className={`fixed right-5 top-5 z-50 rounded px-4 py-2 text-white shadow ${
            status.error ? 'bg-red-500' : 'bg-emerald-600'
          }`}
        >
          {status.text}
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-2xl font-bold">{t('settingsTitle')}</h1>

        <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold">{t('generalSettings')}</h2>
          <label className="mb-1 block text-sm font-medium" htmlFor="gw">
            {t('gatewayLabel')}
          </label>
          <input
            id="gw"
            type="text"
            className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
          />
          <label className="mb-1 block text-sm font-medium" htmlFor="tok">
            {t('tokenLabel')}
          </label>
          <input
            id="tok"
            type="text"
            className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <label className="mb-1 block text-sm font-medium" htmlFor="sess">
            {t('sessionKeyLabel')}
          </label>
          <input
            id="sess"
            type="text"
            className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            value={sessionKey}
            onChange={(e) => setSessionKey(e.target.value)}
          />
          <label className="mb-1 block text-sm font-medium" htmlFor="icon">
            {t('iconLabel')}
          </label>
          <input
            id="icon"
            type="text"
            className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            value={customIcon}
            onChange={(e) => setCustomIcon(e.target.value)}
          />
          <label className="mb-1 block text-sm font-medium" htmlFor="lang">
            {t('languageLabel')}
          </label>
          <select
            id="lang"
            className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            value={locale}
            onChange={(e) => setLocale(e.target.value as OpenClawLocale)}
          >
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
          </select>
          <label className="mb-1 block text-sm font-medium" htmlFor="fade">
            {t('fadeTimeLabel')}
          </label>
          <input
            id="fade"
            type="number"
            min={1}
            className="w-32 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            value={fadeTime}
            onChange={(e) => setFadeTime(e.target.value)}
          />
        </section>

        <section className="mb-6">
          <h2 className="mb-1 text-xl font-semibold">{t('quickOptions')}</h2>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            {t('quickOptionHelp')}
          </p>
          {promptBlock(t('modePage'), pagePrompts, setPagePrompts)}
          {promptBlock(t('modeSelection'), selectionPrompts, setSelectionPrompts)}
          {promptBlock(t('modeImage'), imagePrompts, setImagePrompts)}
        </section>

        <button
          type="button"
          className="w-full rounded-lg bg-blue-600 py-3 text-lg font-medium text-white hover:bg-blue-700"
          onClick={save}
        >
          {t('saveBtn')}
        </button>
      </div>
    </div>
  );
}
