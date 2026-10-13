"use client";

import { Component, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card className="bg-zinc-900/30 border-red-800/30 m-4">
          <CardContent className="p-6 text-center">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-lg font-semibold text-red-400 mt-2">Something went wrong</h3>
            <p className="text-sm text-zinc-500 mt-1">{this.state.error?.message || "An unexpected error occurred"}</p>
            <Button variant="outline" className="mt-4 border-zinc-700" onClick={() => this.setState({ hasError: false })}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
