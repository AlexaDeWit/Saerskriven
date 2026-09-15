import type { Element, Threat } from '@saerskriven/model';
import { Accordion } from 'radix-ui';
import { useEffect, useId, useRef } from 'react';
import { CategoryField } from '../ui/category-field.js';
import { SeverityField } from '../ui/severity-field.js';
import { StatusField } from '../ui/status-field.js';
import { ProseField, TextField } from '../ui/text-field.js';
import styles from './threat-panel.module.css';
import { assumptionKind, mitigationKind, threatTarget } from './records.js';
import { draftIn, useRefusals, type RefusedField } from './refusals.js';
import { RecordGroup } from './threat-records.js';
import { ThreatSummary } from './threat-summary.js';
import { elementLabel } from './threats.js';

/** Focus after adding or deleting a threat. */
export type EditorFocus = 'title' | 'disclosure';

/** A threat, its attachments, and callbacks for edits and refused drafts. */
export type ThreatEditorProps = {
  readonly threat: Threat;
  readonly attachments: readonly Element[];
  readonly focus: EditorFocus | undefined;
  readonly held: RefusedField | undefined;
  readonly onChange: () => void;
  readonly onCommit: (patch: Partial<Threat>) => void;
  readonly onRefusal: (refused: RefusedField | undefined) => void;
  readonly onDelete: () => void;
  readonly onFocused: () => void;
};

/** An expandable threat with one commit per field. */
export function ThreatEditor({
  threat,
  attachments,
  focus,
  held,
  onChange,
  onCommit,
  onRefusal,
  onDelete,
  onFocused,
}: ThreatEditorProps) {
  const titleField = useRef<HTMLInputElement>(null);
  const disclosure = useRef<HTMLButtonElement>(null);
  const spreadId = useId();
  const { refusals, note, refused } = useRefusals(onRefusal);
  const spread = threat.elements.length;

  useEffect(() => {
    if (focus === 'title') {
      titleField.current?.focus();
    }
    if (focus === 'disclosure') {
      disclosure.current?.focus();
    }
    if (focus !== undefined) {
      onFocused();
    }
  }, [focus, onFocused]);

  return (
    <Accordion.Item
      className={styles.item}
      data-threat-item={threat.id}
      value={threat.id}
    >
      <Accordion.Header className={styles.header}>
        <Accordion.Trigger className={styles.disclosure} ref={disclosure}>
          <ThreatSummary threat={threat} />
          <span aria-hidden="true" className={styles.chevron}>
            ▾
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.content}>
        <TextField
          held={draftIn(held, 'Title')}
          label="Title"
          onChange={onChange}
          onCommit={(title) => {
            onCommit({ title });
          }}
          onRefused={refused('Title')}
          ref={titleField}
          value={threat.title}
        />
        <CategoryField
          onCommit={(category) => {
            onCommit({ category });
          }}
          value={threat.category}
        />
        <div className={styles.assessment}>
          <SeverityField
            onCommit={(severity) => {
              onCommit({ severity });
            }}
            value={threat.severity}
          />
          <StatusField
            onCommit={(status) => {
              onCommit({ status });
            }}
            value={threat.status}
          />
        </div>
        <ProseField
          held={draftIn(held, 'Description')}
          label="Description"
          onChange={onChange}
          onCommit={(description) => {
            onCommit({ description });
          }}
          onRefused={refused('Description')}
          value={threat.description}
        />
        <RecordGroup
          held={held}
          kind={mitigationKind}
          onChange={onChange}
          onRefused={note}
          refusals={refusals}
          target={threatTarget(mitigationKind, threat.id)}
        />
        <RecordGroup
          held={held}
          kind={assumptionKind}
          onChange={onChange}
          onRefused={note}
          refusals={refusals}
          target={threatTarget(assumptionKind, threat.id)}
        />
        {spread > 1 && (
          <div className={styles.spread}>
            <p id={spreadId}>
              This threat names {spread} elements. Deleting it takes it off all
              of them.
            </p>
            <ul aria-label="Attached elements" className={styles.attachments}>
              {attachments.map((element) => (
                <li key={element.id}>{elementLabel(element)}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          aria-describedby={spread > 1 ? spreadId : undefined}
          className={styles.delete}
          onClick={onDelete}
          type="button"
        >
          Delete threat {threat.number}
        </button>
      </Accordion.Content>
    </Accordion.Item>
  );
}
