import React from 'react';
import { DEFAULT_GATEWAY } from '@src/lib/openclaw/constants';
import logo from '@assets/img/logo.svg';

export default function Popup() {
  const openSettings = () => {
    void chrome.runtime.openOptionsPage();
  };

  const openGateway = () => {
    window.open(DEFAULT_GATEWAY, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-full bg-openclaw-bg p-4 text-openclaw-text">
      <div className="rounded-openclaw-card border border-openclaw-border bg-openclaw-surface p-4 shadow-openclaw">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-openclaw-card bg-openclaw-primary-soft">
            <img src={logo} className="h-7 w-7 pointer-events-none" alt="OpenClaw logo" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-openclaw-primary-strong">
              OpenClaw
            </div>
            <h1 className="mt-1 text-lg font-semibold">Web Assistant</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-openclaw-muted">
          灰底白卡片布局，主操作与强调态使用橙色，覆盖设置页与侧边栏。
        </p>

        <div className="mt-4 grid gap-2">
          <div className="rounded-openclaw-input bg-openclaw-soft px-4 py-3 text-sm text-openclaw-text">
            白卡片、浅灰输入区、细边框。
          </div>
          <div className="rounded-openclaw-input bg-openclaw-soft px-4 py-3 text-sm text-openclaw-text">
            主要按钮为橙色，悬停略加深。
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-openclaw-pill bg-openclaw-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-openclaw-primary-strong"
            onClick={openSettings}
          >
            打开设置
          </button>
          <button
            type="button"
            className="rounded-openclaw-pill border border-openclaw-border bg-openclaw-surface px-4 py-3 text-sm font-medium text-openclaw-text transition hover:bg-openclaw-soft"
            onClick={openGateway}
          >
            Gateway
          </button>
        </div>
      </div>
    </div>
  );
}
