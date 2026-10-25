/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Top-level error boundary for Labscribber.
 *
 * Without this, any uncaught render error anywhere in the component tree —
 * a malformed file, an edge case in any analysis panel, a corrupted .lsb
 * session — takes the entire application down to a blank white screen with
 * no recovery path and no information about what happened. This is
 * especially important for a tool whose primary job is processing
 * arbitrary, messy real-world instrument data (confirmed firsthand: a real
 * uploaded spectroscopy file surfaced two genuine rendering bugs during
 * development, neither of which were caught by the existing test suite,
 * since 100% of automated test coverage is on math.ts and none of it
 * exercises the actual import/rendering pipeline).
 *
 * This boundary cannot recover application state lost in the crash (React
 * error boundaries unmount the broken subtree), but it can:
 *   - Show a clear, actionable message instead of a blank screen
 * 	 - Offer to reload the app — App.tsx autosaves the current session to
 *     localStorage on a short debounce as the user works (see
 *     src/utils/autosave.ts) and offers to restore it on the next load, so
 *     a reload here has a real chance of recovering most in-progress work,
 *     not just an empty canvas.
 *   - Display the actual error for bug reporting, rather than hiding it
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for now — if a remote error-reporting service is
    // added later, this is the single place to wire it in.
    console.error('Labscribber crashed:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleTryContinue = () => {
    // Attempt to clear the error state and re-render the existing tree.
    // This will only succeed if the error was transient (e.g. triggered by
    // a specific dataset that has since been removed from state by the
    // user navigating away) — if the same error recurs immediately,
    // getDerivedStateFromError will catch it again.
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#09090b',
            color: '#f1f5f9',
            fontFamily: '-apple-system, "Segoe UI", sans-serif',
            padding: '24px',
          }}
        >
          <div style={{ maxWidth: '560px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#fb7185', fontSize: '18px', fontWeight: 700 }}>!</span>
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Labscribber hit an unexpected error
              </h1>
            </div>

            <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.6, marginBottom: '16px' }}>
              Something in the current view caused a crash. This is most often triggered by an
              unusual file format, an edge case in the active dataset, or a corrupted session file.
              Your other browser tabs and any already-saved <code>.lsb</code> session files are
              unaffected. Reloading will also offer to restore your most recent autosaved session.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={this.handleTryContinue}
                style={{
                  flex: 1,
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#f1f5f9',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try to continue
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  background: '#e11d48',
                  border: '1px solid #e11d48',
                  color: 'white',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload Labscribber
              </button>
            </div>

            <details style={{ fontSize: '11px', color: '#71717a' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
                Technical details (for bug reports)
              </summary>
              <pre
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '10px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack || ''}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
