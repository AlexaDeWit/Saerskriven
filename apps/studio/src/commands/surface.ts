import type { DiagramId } from '@saerskriven/model';

/** File operations whose session guards unsaved changes before replacing the model. */
export type FileCommands = {
  open(): void;
  import(): void;
  save(): void;
  saveAs(): void;
  exportDiagram(diagramId?: DiagramId): void;
  exportRegister(): void;
  exportTypst(): void;
  exportPdf(): void;
  exportPng(): void;
  close(): void;
};

/** Moving the canvas, which is React Flow's viewport rather than the model. */
export type ViewCommands = {
  zoomIn(): void;
  zoomOut(): void;
  fitToView(): void;
  fitSelection(): void;
  resetZoom(): void;
};

/** The shortcut reference controlled by a registered command. */
export type ReferenceCommands = {
  toggle(): void;
};

/** Commands that use the file session, shortcut reference, or canvas viewport. */
export type CommandSurface = {
  readonly files: FileCommands;
  readonly reference: ReferenceCommands;
  readonly view: ViewCommands;
};
