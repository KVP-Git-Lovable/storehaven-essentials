import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("AppErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    try {
      // Clear retry flags and any service worker caches that may be serving stale chunks
      Object.keys(window.sessionStorage)
        .filter((k) => k.startsWith("lazyRetry:"))
        .forEach((k) => window.sessionStorage.removeItem(k));
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app failed to load. This is usually caused by an outdated cached version.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-muted-foreground bg-muted p-3 rounded overflow-auto text-left">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
