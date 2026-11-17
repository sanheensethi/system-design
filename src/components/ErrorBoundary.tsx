import { Component, type ReactNode } from 'react';

/** Keeps one broken lesson from blanking the whole site. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: Error | null; key: string }) {
    // Navigating to another lesson clears the error.
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  render() {
    if (this.state.error) {
      return (
        <div className="not-found">
          <h1>This lesson hit a snag.</h1>
          <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{this.state.error.message}</p>
          <a className="btn primary" href="#/">
            Back to the course map
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
