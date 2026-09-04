"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLanguage } from "@/lib/context/LanguageContext";

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

/**
 * Die Standardanzeige im Fehlerfall. Eine Klassen-Komponente kann keine
 * Hooks nutzen, deshalb liegt die Übersetzung in dieser Funktions-Komponente:
 * Die Grenze sitzt innerhalb des LanguageProvider, die Texte kommen aus dem
 * Wörterbuch — vorher stand hier englischer Text in einer deutschen App.
 */
function DefaultFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <p className="text-lg font-semibold text-primary">{t.common.unexpectedError}</p>
        <p className="text-sm text-muted">{error?.message || t.common.unexpectedErrorSub}</p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          {t.common.retry}
        </button>
      </div>
    </div>
  );
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
        <DefaultFallback
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
