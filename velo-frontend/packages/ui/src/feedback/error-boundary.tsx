"use client";

import type { ReactNode } from "react";
import React from "react";
import { Button } from "../primitives/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    // The boundary intentionally swallows the error and exposes a reset action.
    void error;
    void _errorInfo;
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-6">
          <p className="text-sm font-medium text-[hsl(var(--color-foreground))]">
            Something went wrong.
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--color-muted))]">
            The page hit an unexpected error and can be retried.
          </p>
          <div className="mt-4">
            <Button type="button" onClick={this.reset}>
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
