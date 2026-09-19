import type { SvgDocument } from '@saerskriven/render';
import { Data } from 'effect';
import type { Speaker } from '../messages/said.js';
import type { NoticeText } from '../ui/detail-lines.js';
import {
  RenderAssetFailure,
  type RenderAssetFailure as RenderAssetFailureType,
} from './render-assets.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

/**
 * A report from the last export, as data the report region words. Every
 * variant but `Unplaced` is a refusal, which stands until dismissed or
 * replaced. A reason, a compiler sentence or a rasterizer sentence is the
 * text a browser or a compiler raised, and stays a literal line.
 */
export type ExportNotice = Data.TaggedEnum<{
  Unplaced: { readonly unplaced: readonly UnplacedFlow[] };
  WriteRefused: { readonly reason: string };
  AssetsUnavailable: {
    readonly reader: 'compiler' | 'rasterizer';
    readonly failure: RenderAssetFailureType;
  };
  CompileRefused: { readonly sentences: readonly string[] };
  NoPdf: {};
  DrawRefused: { readonly sentence: string };
}>;

/** Constructors for {@link ExportNotice}, plus Effect's `$is` and `$match`. */
export const ExportNotice = Data.taggedEnum<ExportNotice>();

/** Whether a notice reports a refused export rather than a written one. */
export function isRefusal(notice: ExportNotice): boolean {
  return !ExportNotice.$is('Unplaced')(notice);
}

/** An export notice in the reader's language, with ids and raised text unchanged. */
export function describeExportNotice(
  t: Speaker,
  notice: ExportNotice,
): NoticeText {
  return ExportNotice.$match(notice, {
    Unplaced: ({ unplaced }) => ({
      headline: t('reports.unplaced'),
      details: unplaced.map(({ flow, side, element }) =>
        t(
          side === 'source'
            ? 'reports.unplaced-source'
            : 'reports.unplaced-target',
          { flow, element },
        ),
      ),
    }),
    WriteRefused: ({ reason }) => ({
      headline: t('reports.write-refused'),
      details: [reason],
    }),
    AssetsUnavailable: ({ reader, failure }) => ({
      headline: t(
        reader === 'compiler'
          ? 'reports.compiler-unavailable'
          : 'reports.rasterizer-unavailable',
      ),
      details: [assetDetail(t, failure)],
    }),
    CompileRefused: ({ sentences }) => ({
      headline: t('reports.compile-refused'),
      details: sentences,
    }),
    NoPdf: () => ({ headline: t('reports.no-pdf'), details: [] }),
    DrawRefused: ({ sentence }) => ({
      headline: t('reports.draw-refused'),
      details: [sentence],
    }),
  });
}

function assetDetail(t: Speaker, failure: RenderAssetFailureType): string {
  return RenderAssetFailure.$match(failure, {
    Unavailable: ({ reason }) => reason,
    Answered: ({ url, status }) =>
      t('reports.asset-answered', { url, status: String(status) }),
    FaceMissing: ({ face }) => t('reports.face-missing', { face }),
  });
}
