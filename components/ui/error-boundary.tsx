"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
	children: ReactNode;
	fallback?: ReactNode;
	fallbackRender?: (props: { error: Error; reset: () => void }) => ReactNode;
};

type ErrorBoundaryState = {
	hasError: boolean;
	error: Error | null;
};

/**
 * Reusable error boundary for catching render errors in child components.
 * Wrap crash-prone components (e.g. Flow, TiptapEditor) at their call site.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *   <CrashProneComponent />
 * </ErrorBoundary>
 * ```
 *
 * Or with a render function for retry support:
 * ```tsx
 * <ErrorBoundary fallbackRender={({ error, reset }) => (
 *   <div>
 *     <p>{error.message}</p>
 *     <button onClick={reset}>Retry</button>
 *   </div>
 * )}>
 *   <CrashProneComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		console.error("[ErrorBoundary]", error, errorInfo);
	}

	reset = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): ReactNode {
		if (this.state.hasError && this.state.error) {
			if (this.props.fallbackRender) {
				return this.props.fallbackRender({
					error: this.state.error,
					reset: this.reset,
				});
			}

			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex items-center justify-center p-8 text-muted-foreground">
					<p>Something went wrong.</p>
				</div>
			);
		}

		return this.props.children;
	}
}
