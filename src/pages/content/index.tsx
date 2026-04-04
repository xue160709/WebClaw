import { createRoot } from 'react-dom/client';
import OpenClawAssistant from './OpenClawAssistant';
import { registerPageContextBridge } from './pageContextBridge';
import './openclaw-assistant.css';

registerPageContextBridge();

if (!document.getElementById('__openclaw_host')) {
  const host = document.createElement('div');
  host.id = '__openclaw_host';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<OpenClawAssistant />);
}
