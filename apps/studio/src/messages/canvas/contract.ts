import { plural, text } from '@saerskriven/i18n';

const flow = { flow: 'text' } as const;

const bend = { number: 'number', flow: 'text' } as const;

const position = { x: 'number', y: 'number' } as const;

const element = { element: 'text' } as const;

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
  'removed-named': text({ name: 'text' }),
  'removed-elements': plural('count'),
  'flows-detached': plural('count'),
  'threat-links-dropped': plural('count'),
  'bend-added': text(bend),
  'bend-moved': text(bend),
  'bend-removed': text(bend),
  'bend-at': text(position),
  'source-released': text(flow),
  'target-released': text(flow),
  'source-pinned': text({ flow: 'text', side: 'text' }),
  'target-pinned': text({ flow: 'text', side: 'text' }),
  'undo-done': text(),
  'redo-done': text(),
  'threat-deleted': text({ number: 'number' }),
  'record-named': text({ kind: 'text', label: 'text' }),
  'record-unlinked': text({ record: 'text' }),
  'record-removed': text({ record: 'text' }),
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
  'cut-remains': text(),
  'cut-abandoned': text(),
  'records-counts': text({ linked: 'number', cloned: 'number' }),
  'node-moved': text(position),
  'flow-controls': text(),
  'toggle-interactivity': text(),
  minimap: text(),
  handle: text(),
  'resize-top': text(element),
  'resize-right': text(element),
  'resize-bottom': text(element),
  'resize-left': text(element),
  'resize-top-left': text(element),
  'resize-top-right': text(element),
  'resize-bottom-right': text(element),
  'resize-bottom-left': text(element),
} as const;
