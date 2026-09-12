import { Component, ErrorInfo, ReactNode } from "react";

import { ErrorPart } from "@/pages/parts/errors/ErrorPart";
import { createErrorReport } from "@/utils/errorDebugInfo";

interface ErrorBoundaryState {
  error?: {
    error: Error;
    errorInfo: ErrorInfo;
  };
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      error: undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "Render error caught",
      createErrorReport(error, errorInfo.componentStack ?? undefined),
    );
    this.setState((s) => ({
      ...s,
      error: {
        error,
        errorInfo,
      },
    }));
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ErrorPart
        error={this.state.error.error}
        errorInfo={this.state.error.errorInfo}
      />
    );
  }
}
