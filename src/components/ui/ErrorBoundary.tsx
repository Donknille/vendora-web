"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

// TODO: Integrate Sentry for production error tracking once account is set up.
// Replace console.error calls below with Sentry.captureException().

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TODO: Send to Sentry once configured
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <p className="text-lg font-semibold text-primary">
              Something went wrong
            </p>
            <p className="text-sm text-muted">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
