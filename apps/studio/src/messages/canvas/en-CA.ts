import { catalogue } from '@saerskriven/i18n';
import { canvasMessages } from './contract.js';

export const canvasEnCA = catalogue(canvasMessages)('en-CA')({
  quoted: '“{text}”',
  'snap-on': 'Snap to grid on.',
  'snap-off': 'Snap to grid off.',
  'diagram-shown': 'Showing “{title}”.',
  'diagram-added': 'Added “{title}”.',
  'diagram-renamed': 'Renamed the diagram to “{title}”.',
  'selection-cleared': 'Selection cleared.',
  'geometry-updated': 'Position and size updated.',
  'geometry-invalid': 'Enter finite coordinates and positive dimensions.',
  arranged: {
    one: 'Arranged {count} node. Flow bends and free endpoints stayed in place.',
    other:
      'Arranged {count} nodes. Flow bends and free endpoints stayed in place.',
  },
  'source-changed': 'Changed the flow source.',
  'target-changed': 'Changed the flow target.',
  'flow-both-ways': 'Changed {flow} to run both ways.',
  'flow-one-way': 'Changed {flow} to run one way.',
  'removed-named': 'Removed {name}.',
  'removed-elements': {
    one: 'Removed {count} element.',
    other: 'Removed {count} elements.',
  },
  'flows-detached': {
    one: '{count} flow detached.',
    other: '{count} flows detached.',
  },
  'threat-links-dropped': {
    one: '{count} threat link dropped.',
    other: '{count} threat links dropped.',
  },
  'threats-removed': {
    one: '{count} threat removed.',
    other: '{count} threats removed.',
  },
  'bend-added': 'Added bend {number} on {flow}.',
  'bend-moved': 'Moved bend {number} on {flow}.',
  'bend-removed': 'Removed bend {number} from {flow}.',
  'bend-at': 'Bend at {x}, {y}.',
  'source-released': 'Released the source of {flow} to follow its route.',
  'target-released': 'Released the target of {flow} to follow its route.',
  'source-pinned': 'Pinned the source of {flow}. Side: {side}.',
  'target-pinned': 'Pinned the target of {flow}. Side: {side}.',
  'undo-done': 'Undo completed.',
  'redo-done': 'Redo completed.',
  'threat-deleted': 'Threat {number} deleted.',
  'threat-attached-to-actor': 'Attached threat {number} to the actor.',
  'threat-attached-to-actor-named': 'Attached threat {number} to {name}.',
  'threat-attached-to-process': 'Attached threat {number} to the process.',
  'threat-attached-to-process-named': 'Attached threat {number} to {name}.',
  'threat-attached-to-store': 'Attached threat {number} to the store.',
  'threat-attached-to-store-named': 'Attached threat {number} to {name}.',
  'threat-attached-to-text': 'Attached threat {number} to the text.',
  'threat-attached-to-text-named': 'Attached threat {number} to {name}.',
  'threat-attached-to-flow': 'Attached threat {number} to the flow.',
  'threat-attached-to-flow-named': 'Attached threat {number} to {name}.',
  'threat-attached-to-trust-boundary':
    'Attached threat {number} to the trust boundary.',
  'threat-attached-to-trust-boundary-named':
    'Attached threat {number} to {name}.',
  'threat-detached-from-actor':
    'Detached threat {number} from the actor. It stays on its other elements.',
  'threat-detached-from-actor-named':
    'Detached threat {number} from {name}. It stays on its other elements.',
  'threat-detached-from-process':
    'Detached threat {number} from the process. It stays on its other elements.',
  'threat-detached-from-process-named':
    'Detached threat {number} from {name}. It stays on its other elements.',
  'threat-detached-from-store':
    'Detached threat {number} from the store. It stays on its other elements.',
  'threat-detached-from-store-named':
    'Detached threat {number} from {name}. It stays on its other elements.',
  'threat-detached-from-text':
    'Detached threat {number} from the text. It stays on its other elements.',
  'threat-detached-from-text-named':
    'Detached threat {number} from {name}. It stays on its other elements.',
  'threat-detached-from-flow':
    'Detached threat {number} from the flow. It stays on its other elements.',
  'threat-detached-from-flow-named':
    'Detached threat {number} from {name}. It stays on its other elements.',
  'threat-detached-from-trust-boundary':
    'Detached threat {number} from the trust boundary. It stays on its other elements.',
  'threat-detached-from-trust-boundary-named':
    'Detached threat {number} from {name}. It stays on its other elements.',
  'threat-detach-removed':
    'Removed threat {number}. It was attached to nothing else. Undo restores it.',
  'record-named': '{kind} “{label}”',
  'record-unlinked': 'Unlinked {record}. It stays on its other references.',
  'record-removed': 'Removed {record}. Nothing else used it. Undo restores it.',
  'copy-nothing-selected': 'Select elements to copy.',
  'copy-refused': 'The selection could not be copied.',
  'copy-too-large': 'The selection exceeds the clipboard size limit.',
  'clipboard-write-failed':
    'Clipboard write failed. Nothing was cut. Check browser clipboard permission.',
  'clipboard-read-failed':
    'Clipboard read failed. Check browser clipboard permission.',
  'paste-document-changed':
    'The document changed while reading the clipboard. Paste again.',
  'paste-no-selection': 'The clipboard contains no Saerskriven selection.',
  'paste-invalid':
    'The clipboard selection is invalid, unsupported, or exceeds a read limit.',
  'paste-no-diagram': 'There is no diagram to paste into.',
  'paste-remap-failed': 'The copied graph could not be remapped.',
  copied: 'Copied the selection.',
  cut: 'Cut the selection.',
  duplicated: 'Duplicated the selection.',
  pasted: 'Pasted the selection with new element and threat IDs.',
  'copy-counts':
    'Elements: {elements}. Threats: {threats}. External links excluded: {excluded}.',
  'copy-source-fields':
    'Source-format fields outside the model are not copied.',
  'cut-threat-counts': {
    one: 'Threats copied: {copied}, of which {removed} was removed with its last element.',
    other:
      'Threats copied: {copied}, of which {removed} were removed with their last element.',
  },
  'cut-remains':
    'A threat left attached to nothing is removed, and one attached elsewhere stays in the register. Other attached flows retain free endpoints.',
  'cut-abandoned': 'The selection changed while copying. Nothing was cut.',
  'records-counts': 'Records linked: {linked}. Records cloned: {cloned}.',
  'node-moved': 'Moved the selection. New position, x: {x}, y: {y}.',
  'flow-controls': 'Canvas controls',
  'toggle-interactivity': 'Toggle editing',
  minimap: 'Diagram overview',
  handle: 'Connection point',
  'element-role': 'element',
  'flow-role': 'flow',
  'resize-top': 'Resize {element} from top',
  'resize-right': 'Resize {element} from right',
  'resize-bottom': 'Resize {element} from bottom',
  'resize-left': 'Resize {element} from left',
  'resize-top-left': 'Resize {element} from top left corner',
  'resize-top-right': 'Resize {element} from top right corner',
  'resize-bottom-right': 'Resize {element} from bottom right corner',
  'resize-bottom-left': 'Resize {element} from bottom left corner',
});
