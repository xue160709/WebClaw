import { resolve } from 'path';
import { mergeConfig, defineConfig } from 'vite';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import baseConfig, { baseManifest, baseBuildOptions } from './vite.config.base';

const outDir = resolve(__dirname, 'dist_firefox');

/** Firefox has no chrome.sidePanel; keep the floating content-script UI instead. */
function firefoxManifestFromBase(m: ManifestV3Export): ManifestV3Export {
  const { side_panel: _sidePanel, ...rest } = m as ManifestV3Export & {
    side_panel?: unknown;
  };
  const permissions = (m.permissions ?? []).filter((p) => p !== 'sidePanel');
  return {
    ...rest,
    permissions,
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['src/pages/content/index.tsx'],
      },
    ],
  };
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      crx({
        manifest: {
          ...firefoxManifestFromBase(baseManifest),
          background: {
            scripts: ['src/pages/background/index.ts'],
          },
        } as ManifestV3Export,
        browser: 'firefox',
        contentScripts: {
          injectCss: true,
        }
      })
    ],
    build: {
      ...baseBuildOptions,
      outDir
    },
    publicDir: resolve(__dirname, 'public'),
  })
)
