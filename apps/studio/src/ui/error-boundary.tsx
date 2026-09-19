import { Component, type ReactNode } from 'react';
import { useTranslator } from '../messages/locale.js';
import { reasonOf } from '../reason.js';
import styles from './error-boundary.module.css';

type BoundaryState = { readonly message: string | undefined };

type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly reload?: () => void;
};

function reloadPage(): void {
  globalThis.location.reload();
}

/**
 * Shows an unexpected render failure and offers a page reload, which a spec
 * replaces through `reload`. The failure's own text is what the browser or
 * the code raised, and is shown as it came.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  BoundaryState
> {
  override state: BoundaryState = { message: undefined };

  static getDerivedStateFromError(cause: unknown): BoundaryState {
    return { message: reasonOf(cause) };
  }

  override render(): ReactNode {
    const { message } = this.state;
    if (message === undefined) {
      return this.props.children;
    }

    return (
      <Stopped message={message} reload={this.props.reload ?? reloadPage} />
    );
  }
}

function Stopped({
  message,
  reload,
}: {
  readonly message: string;
  readonly reload: () => void;
}) {
  const { t } = useTranslator();
  return (
    <section aria-label={t('shell.stopped')} className={styles.stopped}>
      <h1 className={styles.headline}>{t('shell.stopped')}</h1>
      <p>{t('shell.stopped-explanation')}</p>
      <p className={styles.detail}>{message}</p>
      <button className={styles.reload} onClick={reload} type="button">
        {t('shell.reload')}
      </button>
    </section>
  );
}
