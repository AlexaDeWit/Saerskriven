/// <reference types="vitest" />
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { cacheDir, sharedTest } from './vitest.shared.mts';

type SocialImage = {
  readonly alt: string;
  readonly height: number;
  readonly path: string;
  readonly width: number;
};

const pageMetadata = (html: string) => {
  const title = html.match(/<title>([^<]+)<\/title>/u)?.[1]?.trim();
  const description = html
    .match(/<meta\s+name="description"\s+content="([^"]+)"/u)?.[1]
    ?.trim();

  if (title === undefined || description === undefined) {
    throw new Error('The page must declare its title and description.');
  }

  return { description, title };
};

const metadataTag = (attrs: Record<string, string>) => ({
  tag: 'meta',
  attrs,
  injectTo: 'head' as const,
});

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => {
      const hashes = [
        ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu),
      ]
        .filter(([, attributes]) => !/\bsrc\s*=/u.test(attributes ?? ''))
        .map(
          ([, , body]) =>
            `'sha256-${createHash('sha256')
              .update(body ?? '')
              .digest('base64')}'`,
        );
      const policy = [
        "default-src 'none'",
        ["script-src 'self' 'wasm-unsafe-eval'", ...hashes].join(' '),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self'",
        "font-src 'none'",
        "connect-src 'self'",
        "worker-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "manifest-src 'none'",
      ].join('; ');
      return [
        {
          ...metadataTag({
            'http-equiv': 'Content-Security-Policy',
            content: policy,
          }),
          injectTo: 'head-prepend',
        },
      ];
    },
  },
});

// GitHub Pages reports http before HTTPS enforcement. Canonical URLs stay https.
const httpsSiteUrl = (siteUrl: string): string => {
  const url = new URL(siteUrl);
  url.protocol = 'https:';
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
};

const siteFiles = (siteUrl: string, socialImage?: SocialImage): Plugin => {
  const canonicalUrl = httpsSiteUrl(siteUrl);

  return {
    name: 'site-files',
    apply: 'build',
    transformIndexHtml: (html) => {
      const canonical = {
        tag: 'link',
        attrs: { href: canonicalUrl, rel: 'canonical' },
        injectTo: 'head' as const,
      };

      if (socialImage === undefined) {
        return [canonical];
      }

      const { description, title } = pageMetadata(html);
      const imageUrl = new URL(socialImage.path, canonicalUrl).href;

      return [
        canonical,
        metadataTag({ property: 'og:type', content: 'website' }),
        metadataTag({ property: 'og:title', content: title }),
        metadataTag({ property: 'og:description', content: description }),
        metadataTag({ property: 'og:url', content: canonicalUrl }),
        metadataTag({ property: 'og:image', content: imageUrl }),
        metadataTag({ property: 'og:image:type', content: 'image/png' }),
        metadataTag({
          property: 'og:image:width',
          content: String(socialImage.width),
        }),
        metadataTag({
          property: 'og:image:height',
          content: String(socialImage.height),
        }),
        metadataTag({ property: 'og:image:alt', content: socialImage.alt }),
        metadataTag({ name: 'twitter:card', content: 'summary_large_image' }),
        metadataTag({ name: 'twitter:image', content: imageUrl }),
        metadataTag({ name: 'twitter:image:alt', content: socialImage.alt }),
      ];
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl}sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${canonicalUrl}</loc>
  </url>
</urlset>
`,
      });
    },
  };
};

type ReactLibOptions = {
  readonly setupFiles?: string[];
};

export const reactLib = (
  projectRoot: string,
  { setupFiles = [] }: ReactLibOptions = {},
) =>
  defineConfig({
    root: projectRoot,
    cacheDir: cacheDir(projectRoot),
    plugins: [react()],
    test: sharedTest(projectRoot, 'jsdom', setupFiles),
  });

type ReactAppOptions = {
  readonly base?: string;
  readonly cacheDirectory?: string;
  readonly outDirectory?: string;
  readonly port?: number;
  readonly plugins?: PluginOption[];
  readonly setupFiles?: string[];
  readonly siteUrl?: string;
  readonly socialImage?: SocialImage;
};

export const reactApp = (
  projectRoot: string,
  {
    base,
    cacheDirectory,
    outDirectory = './dist',
    port = 4200,
    plugins = [],
    setupFiles = [],
    siteUrl,
    socialImage,
  }: ReactAppOptions = {},
) =>
  defineConfig({
    base,
    root: projectRoot,
    cacheDir: cacheDirectory ?? cacheDir(projectRoot),
    plugins: [
      react(),
      ...plugins,
      ...(siteUrl === undefined ? [] : [siteFiles(siteUrl, socialImage)]),
      contentSecurityPolicy(),
    ],
    server: { port, host: 'localhost' },
    preview: { port, host: 'localhost' },
    build: {
      outDir: outDirectory,
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: { transformMixedEsModules: true },
    },
    test: sharedTest(projectRoot, 'jsdom', setupFiles),
  });
