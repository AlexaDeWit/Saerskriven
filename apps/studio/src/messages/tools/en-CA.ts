import { catalogue } from '@saerskriven/i18n';
import { toolMessages } from './contract.js';

export const toolsEnCA = catalogue(toolMessages)('en-CA')({
  'diagram-region': 'Diagram',
  'free-point': 'a free point',
  'flow-between': 'between {source} and {target}',
  'flow-from-to': 'from {source} to {target}',
  'open-threats': {
    one: '{count} open threat',
    other: '{count} open threats',
  },
  'severity-not-assessed': 'severity not assessed',
  'highest-severity': 'highest severity {severity}',
  'zoom-and-fit': 'Zoom and fit',
  'current-zoom': 'Current zoom: {percent}%.',
  'flow-target': 'Flow target',
  'choose-flow-target': 'Choose a flow target',
  'reconnect-flow': 'Reconnect flow',
  'flow-endpoint': 'Flow endpoint',
  'select-node-geometry': 'Select a node to edit its geometry.',
  'select-one-flow': 'Select one flow to reconnect it.',
  close: 'Close',
  cancel: 'Cancel',
  'apply-geometry': 'Apply geometry',
  'apply-endpoint': 'Apply endpoint',
  'axis-x': 'X',
  'axis-y': 'Y',
  width: 'Width',
  height: 'Height',
  decrease: 'Decrease {label}',
  increase: 'Increase {label}',
  source: 'Source',
  target: 'Target',
  side: 'Side',
  automatic: 'Automatic',
  'flow-route': 'Flow route',
  'bend-actions': 'Bend actions',
  'flow-end-actions': 'Flow end actions',
  'bend-numbered': 'Bend {number}',
  'flow-source-end': 'Flow source end',
  'flow-target-end': 'Flow target end',
  'remove-bend': 'Remove bend',
  'move-bend': 'Move bend',
  'follow-route': 'Follow the route',
  'bend-handle-help':
    'Drag or use arrow keys to move. Click for actions. Delete removes this bend.',
  'flow-end-handle-help':
    'Drag to another side of its element. Arrow keys pin a side, Delete lets it follow the route. Click for actions.',
  'bend-choose-help':
    'Segment {number}: Left/Right to choose, Enter to add. Or click a segment.',
  'bend-place-help':
    'Arrow keys move the bend. Enter confirms, Escape cancels. Or click its destination.',
  'bend-idle-help':
    'Pull the line to add a bend. Drag a bend to move it. Drag an end to another side of its element. Click a handle for actions.',
});
