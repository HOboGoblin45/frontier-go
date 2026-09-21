import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordError } from '../../core/platform/errorLog';
import { Wordmark } from './Wordmark';

/**
 * The last line. A React crash is the one failure the channel cannot skip past,
 * so it gets the only full-screen message in the product — and a way back in.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { failed: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    recordError('react', error.message, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="onboarding">
        <div />
        <div style={{ textAlign: 'center' }}>
          <Wordmark size="var(--step-3)" />
          <p className="onboarding__line" style={{ fontSize: 'var(--step-1)' }}>
            Something stopped working.
          </p>
          <p className="meta muted" style={{ marginTop: 'var(--space-3)' }}>{this.state.message}</p>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => window.location.reload()}
        >
          Start again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
