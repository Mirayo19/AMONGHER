import { Component, type ReactNode } from 'react';

/** Last-resort safety net: a rendering bug shows a calm recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Unhandled UI error', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-ink-muted">Your data is safe. Reloading usually fixes it.</p>
        <div className="mt-6 flex gap-3">
          <button className="btn-primary" onClick={() => location.reload()}>Reload</button>
          <a className="btn-secondary" href="/">Go home</a>
        </div>
      </div>
    );
  }
}
