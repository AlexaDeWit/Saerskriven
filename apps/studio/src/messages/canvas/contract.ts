import { plural, text } from '@saerskriven/i18n';

const flow = { flow: 'text' } as const;

const bend = { number: 'number', flow: 'text' } as const;

const boundary = { boundary: 'text' } as const;

const point = { number: 'number', boundary: 'text' } as const;

const position = { x: 'number', y: 'number' } as const;

const writtenPosition = { x: 'text', y: 'text' } as const;

const element = { element: 'text' } as const;

const numbered = { number: 'number' } as const;

const numberedName = { number: 'number', name: 'text' } as const;

const numberedEnds = { number: 'number', ends: 'text' } as const;

/**
 * What the canvas says: its announcements, the clipboard's reports, and the
 * accessible text React Flow and the resize controls take from the studio.
 */
export const canvasMessages = {
  quoted: text({ text: 'text' }),
  'snap-on': text(),
  'snap-off': text(),
  'diagram-shown': text({ title: 'text' }),
  'diagram-added': text({ title: 'text' }),
  'diagram-renamed': text({ title: 'text' }),
  'selection-cleared': text(),
  'geometry-updated': text(),
  'geometry-invalid': text(),
  arranged: plural('count'),
  'source-changed': text(),
  'target-changed': text(),
  'flow-both-ways': text(flow),
  'flow-one-way': text(flow),
  'flow-reversed': text(flow),
  'boundary-curved': text(boundary),
  'boundary-boxed': text(boundary),
  'point-added': text(point),
  'point-moved': text(point),
  'point-removed': text(point),
  'point-kept': text(),
  'removed-named': text({ name: 'text' }),
  'removed-elements': plural('count'),
  'flows-detached': plural('count'),
  'threat-links-dropped': plural('count'),
  'threats-removed': plural('count'),
  'bend-added': text(bend),
  'bend-moved': text(bend),
  'bend-removed': text(bend),
  'bend-at': text(position),
  'source-released': text(flow),
  'target-released': text(flow),
  'source-pinned': text({ flow: 'text', side: 'text' }),
  'target-pinned': text({ flow: 'text', side: 'text' }),
  'source-freed': text(flow),
  'target-freed': text(flow),
  'source-moved': text(flow),
  'target-moved': text(flow),
  'free-end-kept': text(),
  'position-invalid': text(),
  'undo-done': text(),
  'redo-done': text(),
  'threat-deleted': text(numbered),
  'threat-attached-to-actor': text(numbered),
  'threat-attached-to-actor-named': text(numberedName),
  'threat-attached-to-process': text(numbered),
  'threat-attached-to-process-named': text(numberedName),
  'threat-attached-to-store': text(numbered),
  'threat-attached-to-store-named': text(numberedName),
  'threat-attached-to-text': text(numbered),
  'threat-attached-to-text-named': text(numberedName),
  'threat-attached-to-flow': text(numberedEnds),
  'threat-attached-to-flow-named': text(numberedName),
  'threat-attached-to-trust-boundary': text(numbered),
  'threat-attached-to-trust-boundary-named': text(numberedName),
  'threat-detached-from-actor': text(numbered),
  'threat-detached-from-actor-named': text(numberedName),
  'threat-detached-from-process': text(numbered),
  'threat-detached-from-process-named': text(numberedName),
  'threat-detached-from-store': text(numbered),
  'threat-detached-from-store-named': text(numberedName),
  'threat-detached-from-text': text(numbered),
  'threat-detached-from-text-named': text(numberedName),
  'threat-detached-from-flow': text(numberedEnds),
  'threat-detached-from-flow-named': text(numberedName),
  'threat-detached-from-trust-boundary': text(numbered),
  'threat-detached-from-trust-boundary-named': text(numberedName),
  'threat-detach-removed': text(numbered),
  'record-named': text({ kind: 'text', label: 'text' }),
  'record-unlinked': text({ record: 'text' }),
  'record-removed': text({ record: 'text' }),
  'mitigation-added': text(numbered),
  'assumption-added': text(numbered),
  'copy-nothing-selected': text(),
  'copy-refused': text(),
  'copy-too-large': text(),
  'clipboard-write-failed': text(),
  'clipboard-read-failed': text(),
  'paste-document-changed': text(),
  'paste-no-selection': text(),
  'paste-invalid': text(),
  'paste-no-diagram': text(),
  'paste-remap-failed': text(),
  copied: text(),
  cut: text(),
  duplicated: text(),
  pasted: text(),
  'copy-counts': text({
    elements: 'number',
    threats: 'number',
    excluded: 'number',
  }),
  'copy-source-fields': text(),
  'cut-threat-counts': plural('removed', { copied: 'number' }),
  'cut-remains': text(),
  'cut-abandoned': text(),
  'records-counts': text({ linked: 'number', cloned: 'number' }),
  'node-moved': text(writtenPosition),
  'flow-controls': text(),
  'toggle-interactivity': text(),
  minimap: text(),
  handle: text(),
  'element-role': text(),
  'flow-role': text(),
  'resize-top': text(element),
  'resize-right': text(element),
  'resize-bottom': text(element),
  'resize-left': text(element),
  'resize-top-left': text(element),
  'resize-top-right': text(element),
  'resize-bottom-right': text(element),
  'resize-bottom-left': text(element),
} as const;
