import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // clientDiagnostics에 자동 수집됨 (console.error 가로채기)
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card p-8 space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold">화면을 불러오지 못했어요</h1>
            <p className="text-sm text-muted-foreground">
              일시적인 오류일 수 있습니다. 새로고침 후에도 같은 문제가 반복되면 관리자에게 알려주세요.
            </p>
          </div>
          {this.state.error?.message && (
            <pre className="text-[11px] text-left p-3 rounded-lg bg-muted/30 overflow-x-auto font-mono">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="h-4 w-4" /> 새로고침
            </button>
            <button
              onClick={this.handleHome}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }
}
