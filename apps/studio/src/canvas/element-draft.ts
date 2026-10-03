import type {
  Decimals,
  Element,
  Model,
  OperationFailure,
} from '@saerskriven/model';
import { Either } from 'effect';
import { useMemo, useState } from 'react';
import type { Said } from '../messages/said.js';
import type { Action } from '../store/actions.js';
import { selectedElement, selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { currentLayout } from './layout.js';
import { currentTool, useTool } from './tools.js';

/**
 * How the selected element of one kind is edited: which element it is, what
 * a target does to the model while previewed, the one action that commits
 * it at a count of decimals, and what the committed edit says.
 */
export type ElementEdit<Subject extends Element, Target extends object> = {
  readonly subject: (element: Element) => Subject | undefined;
  readonly edited: (
    model: Model,
    subject: Subject,
    target: Target,
  ) => Either.Either<Model, OperationFailure>;
  readonly action: (
    subject: Subject,
    target: Target,
    decimals: Decimals | undefined,
  ) => Action | undefined;
  readonly said: (subject: Subject, target: Target) => Said;
};

type Draft<Subject, Target> = Target & {
  readonly subject: Subject;
  readonly state: State;
  readonly transition: number;
};

/**
 * Previews an edit of the one selected element and commits it as one
 * dispatch. The element is `edit`'s subject while the Select tool is active
 * and no text field is open, and a preview lasts while the model, the
 * selection, the open field and the tool stay as they were. A commit names
 * the decimals its edit stores, and one that names none stores its points as
 * they are.
 */
export function useElementDraft<Subject extends Element, Target extends object>(
  edit: ElementEdit<Subject, Target>,
) {
  const state = useModelStore((value) => value);
  const tool = useTool();
  const [held, setHeld] = useState<Draft<Subject, Target> | undefined>();
  const element = selectedElementRecord(state);
  const subject =
    tool.active === 'select' &&
    state.inlineEditor === undefined &&
    element !== undefined
      ? edit.subject(element)
      : undefined;
  const context = useMemo(
    () => ({ subject, model: state.present, transition: tool.transition }),
    [subject, state.present, tool.transition],
  );
  const draft = held !== undefined && currentDraft(held) ? held : undefined;
  if (held !== undefined && draft === undefined) {
    setHeld(undefined);
  }
  const outcome = useMemo(
    () =>
      draft === undefined
        ? undefined
        : edit.edited(state.present, draft.subject, draft),
    [edit, state.present, draft],
  );
  const present =
    outcome !== undefined && Either.isRight(outcome)
      ? outcome.right
      : state.present;

  return {
    context,
    subject,
    draft,
    layout: currentLayout({ present, activeDiagram: state.activeDiagram }),
    preview: (target: Target): void => {
      if (subject !== undefined) {
        setHeld({ ...target, subject, state, transition: tool.transition });
      }
    },
    commit: (target: Target, decimals?: Decimals): void => {
      if (
        subject === undefined ||
        modelStore.getState().present !== state.present ||
        selectedElement(modelStore.getState()) !== subject.id ||
        currentTool().transition !== tool.transition ||
        (held !== undefined && !currentDraft(held))
      ) {
        return;
      }
      const action = edit.action(subject, target, decimals);
      if (action === undefined) {
        return;
      }
      const before = modelStore.getState().present;
      dispatch(action);
      setHeld(undefined);
      if (modelStore.getState().present !== before) {
        announce(edit.said(subject, target));
      }
    },
    cancel: (): void => {
      setHeld(undefined);
    },
  };
}

function currentDraft<Subject extends Element, Target>(
  draft: Draft<Subject, Target>,
): boolean {
  const state = modelStore.getState();
  const tool = currentTool();
  return (
    state.present === draft.state.present &&
    selectedElement(state) === draft.subject.id &&
    state.inlineEditor === draft.state.inlineEditor &&
    tool.active === 'select' &&
    tool.transition === draft.transition
  );
}
