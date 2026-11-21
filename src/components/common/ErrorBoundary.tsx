import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Avencis Application Error]', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage } = this.props;
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-on-surface">
          <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl p-8 space-y-6">
            <div className="flex items-center space-x-3 text-warning">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-xl text-primary">
                  {fallbackTitle || 'Something went wrong'}
                </h1>
                <p className="text-xs text-on-surface-variant">
                  {fallbackMessage || 'The view encountered an unexpected error while loading.'}
                </p>
              </div>
            </div>

            <div className="text-sm text-on-surface-variant bg-surface-container-low p-4 rounded-xl space-y-2 border border-outline-variant/20">
              <p className="font-medium text-xs text-on-surface">
                {error?.message || 'An unhandled rendering exception occurred.'}
              </p>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Your session and data are secure. You can reload this view to continue or navigate to the master dashboard.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.toggleDetails}
                className="flex items-center space-x-1 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
              >
                <span>Technical details</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showDetails && (
              <div className="mt-4 p-3 bg-neutral-900 text-neutral-100 rounded-lg text-[10px] font-mono overflow-auto max-h-48 border border-neutral-700">
                <div className="text-red-400 font-bold mb-1">{error?.toString()}</div>
                <div className="text-neutral-400 whitespace-pre-wrap">{errorInfo?.componentStack || error?.stack}</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
