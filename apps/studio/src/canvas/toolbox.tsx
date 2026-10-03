import { CursorArrowIcon, HandIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { IconCommandButton } from '../commands/command-button.js';
import { toolCommands } from '../commands/registry.js';
import { useTranslator } from '../messages/locale.js';
import { strokeGlyph } from './stroke-glyph.js';
import { isElementTool, lockTool, tools, useTool, type Tool } from './tools.js';
import styles from './toolbox.module.css';

const glyphs: Record<Tool, ReactNode> = {
  select: <CursorArrowIcon aria-hidden="true" className={styles.icon} />,
  actor: strokeGlyph(<rect x="2.5" y="4" width="11" height="8" />),
  process: strokeGlyph(<circle cx="8" cy="8" r="5.5" />),
  store: strokeGlyph(<path d="M2.5 4h11M2.5 12h11" />),
  note: strokeGlyph(<path d="M3 2.5h10v11H3zM5 5h6M5 7.5h6M5 10h4" />),
  'boundary-box': strokeGlyph(<rect x="2.5" y="3" width="11" height="10" />),
  'boundary-curve': strokeGlyph(<path d="M2 11C4 3 8 3 9 8s3 5 5-2" />),
  hand: <HandIcon aria-hidden="true" className={styles.icon} />,
};

/** The tool modes, as row two of the shell's chrome card. */
export function Toolbox() {
  const mode = useTool();
  const { t } = useTranslator();

  return (
    <section
      aria-label={t('commands.group-tools')}
      className={styles.row}
      data-testid="toolbox"
    >
      {tools.map((tool) => (
        <IconCommandButton
          className={styles.control}
          command={toolCommands[tool]}
          key={tool}
          onDoubleClick={
            isElementTool(tool)
              ? () => {
                  lockTool(tool);
                }
              : undefined
          }
          pressed={mode.active === tool}
          side="bottom"
        >
          {glyphs[tool]}
        </IconCommandButton>
      ))}
    </section>
  );
}
