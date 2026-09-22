import { Component, type ErrorInfo, type ReactNode } from "react";
import { PageError } from "../components/ui";

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page">
          <PageError error={this.state.error} onRetry={() => window.location.reload()} />
        </main>
      );
    }
    return this.props.children;
  }
}
