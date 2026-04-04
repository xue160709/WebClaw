export type OpenClawLocale = 'en' | 'zh-TW';

export const OPENCLAW_I18N: Record<
  OpenClawLocale,
  Record<string, string>
> = {
  en: {
    settingsTitle: 'OpenClaw Settings',
    tokenLabel: 'OpenClaw Token (Required)',
    gatewayLabel: 'Gateway URL',
    sessionKeyLabel: 'Default Session Key',
    iconLabel: 'Custom Icon (Emoji)',
    fadeTimeLabel: 'Fade Time (Seconds)',
    saveBtn: 'Save Settings',
    statusSaved: 'Settings saved!',
    statusError: 'Token is required!',
    modePage: 'Page Mode',
    modeSelection: 'Selection Mode',
    modeImage: 'Image Mode',
    placeholder:
      'Type a message... (Enter to send, Shift+Enter for new line)',
    defaultWelcome:
      'Hello! I am your OpenClaw Assistant. How can I help you? 🦞',
    fullScreen: 'Full Screen',
    minimize: 'Minimize',
    close: 'Close',
    settings: 'Settings',
    quickOptions: 'Quick Options',
    quickOptionHelp: 'Add Quick Options (Use {url}, {text}, {imageUrl})',
    assistantName: 'OpenClaw Assistant',
    addPrompt: 'Add Prompt',
    removePrompt: 'Remove',
    promptLabel: 'Label',
    promptContent: 'Prompt Content',
    languageLabel: 'Language',
    generalSettings: 'General',
    menuRootTitle: 'OpenClaw Assistant 🦞',
  },
  'zh-TW': {
    settingsTitle: '龍蝦助理設定',
    tokenLabel: 'OpenClaw Token (必填)',
    gatewayLabel: 'Gateway URL',
    sessionKeyLabel: '預設 Session Key',
    iconLabel: '自訂圖示 (Emoji)',
    fadeTimeLabel: '對話淡化時間 (秒)',
    saveBtn: '儲存設定',
    statusSaved: '設定已儲存！',
    statusError: 'Token 為必填欄位！',
    modePage: '整頁模式',
    modeSelection: '框選模式',
    modeImage: '圖片模式',
    placeholder: '輸入訊息... (Enter 發送, Shift+Enter 換行)',
    defaultWelcome: '你好！我是你的龍蝦助理。有什麼我可以幫你的嗎？🦞',
    fullScreen: '全螢幕',
    minimize: '縮小',
    close: '關閉',
    settings: '設定',
    quickOptions: '快速選項',
    quickOptionHelp: '新增快速選項 (支援 {url}, {text}, {imageUrl})',
    assistantName: '龍蝦助理',
    addPrompt: '新增 Prompt',
    removePrompt: '移除',
    promptLabel: '標籤名稱',
    promptContent: 'Prompt 內容',
    languageLabel: '語言',
    generalSettings: '一般',
    menuRootTitle: 'OpenClaw 龍蝦助理 🦞',
  },
};

export function tString(locale: OpenClawLocale, key: string): string {
  const pack = OPENCLAW_I18N[locale]?.[key];
  if (pack) return pack;
  return OPENCLAW_I18N.en[key] ?? key;
}
