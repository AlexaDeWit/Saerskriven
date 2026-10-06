import { hostedStudioUrl } from '@saerskriven/formats/hosted-studio';
import { versionDefine, workspaceVersion } from '../../workspace-version.mts';
import { reactApp } from '../../vite.shared.mts';
import {
  initialColourModeScript,
  initialPageStylesheet,
} from './initial-page.mjs';
import { socialCardAsset, socialImage } from './social-card.mjs';
import { buildAssets } from './build-assets.mjs';
import { typstCspCallbacks } from './typst-csp.mjs';

const siteUrl = process.env['PAGES_SITE_URL'] ?? hostedStudioUrl;
const pagesBasePath = process.env['PAGES_BASE_PATH'];
const base =
  pagesBasePath === undefined
    ? undefined
    : `${pagesBasePath.replace(/\/+$/u, '')}/`;

type StudioConfigOptions = {
  readonly cacheDirectory?: string;
  readonly outDirectory?: string;
};

const initialPageStyles = () => ({
  name: 'initial-page-styles',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: { 'data-initial-colour-mode': '' },
      children: initialColourModeScript,
      injectTo: 'head-prepend' as const,
    },
    {
      tag: 'style',
      attrs: { 'data-studio-theme': '' },
      children: initialPageStylesheet,
      injectTo: 'head-prepend' as const,
    },
  ],
});

const schemaConfiguration = () => ({
  name: 'studio-schema-configuration',
  apply: 'build' as const,
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: { 'data-studio-schema-config': '' },
      children: 'globalThis.__zod_globalConfig = { jitless: true };',
      injectTo: 'head-prepend' as const,
    },
  ],
});

const versionStamp = () => {
  const version = workspaceVersion();
  const tag = process.env['SAERSKRIVEN_RELEASE_TAG'] ?? '';
  const build = process.env['GITHUB_SHA'] ?? 'development';
  return {
    name: 'studio-version',
    config: () => ({
      define: {
        ...versionDefine(),
        SAERSKRIVEN_RELEASE_TAG: JSON.stringify(tag),
        SAERSKRIVEN_BUILD_ID: JSON.stringify(build),
      },
    }),
    buildStart() {
      if (tag !== '' && tag !== `v${version}`) {
        this.error(
          `Release tag ${tag} disagrees with workspace version ${version}.`,
        );
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, tag }),
      });
    },
  } satisfies import('vite').Plugin;
};

export const studioConfig = (options: StudioConfigOptions = {}) =>
  reactApp(import.meta.dirname, {
    base,
    plugins: [
      versionStamp(),
      initialPageStyles(),
      schemaConfiguration(),
      typstCspCallbacks(),
      buildAssets(),
      socialCardAsset(),
    ],
    // The canvas and studio setup modules supply browser APIs jsdom omits.
    setupFiles: ['@saerskriven/canvas/test-setup', './src/test-setup.ts'],
    siteUrl,
    socialImage,
    ...options,
  });

export default studioConfig();
