"use client";

/**
 * Double Click Handler Component
 *
 * Detects double-click interactions on the React Flow canvas and manages
 * the node creation workflow. Shows visual feedback and handles edge cases.
 *
 * Features:
 * - Double-click detection on canvas (not on nodes/edges)
 * - Visual feedback (ripple effect at click point)
 * - Keyboard shortcuts (Shift+Click for quick create)
 * - Debounced click handling
 * - World coordinate calculation
 *
 * @component
 */

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import React, { type ReactNode, useCallback, useRef, useState } from "react";
import { useReactFlow } from "reactflow";
import { screenToFlowPosition } from "./creation-utils";

type Position = {
	x: number;
	y: number;
};

type CreationIndicatorProps = {
	position: Position;
	onComplete: () => void;
};

/**
 * Creation indicator component (ripple effect)
 */
const CreationIndicator = ({
	position,
	onComplete,
}: CreationIndicatorProps) => (
	<motion.div
		animate={{ scale: 2, opacity: 0 }}
		className="pointer-events-none absolute z-50"
		exit={{ opacity: 0 }}
		initial={{ scale: 0, opacity: 1 }}
		onAnimationComplete={onComplete}
		style={{
			left: position.x,
			top: position.y,
			transform: "translate(-50%, -50%)",
		}}
		transition={{ duration: 0.5, ease: "easeOut" }}
	>
		<div className="h-16 w-16 rounded-full border-2 border-blue-400 bg-blue-400/20" />
		<div className="absolute inset-0 flex items-center justify-center">
			<Plus className="h-8 w-8 text-blue-400" strokeWidth={3} />
		</div>
	</motion.div>
);

type DoubleClickHandlerProps = {
	onDoubleClick?: (position: Position, event: React.MouseEvent) => void;
	onQuickCreate?: (position: Position, event: React.MouseEvent) => void;
	enabled?: boolean;
	debounceMs?: number;
	showVisualFeedback?: boolean;
	children: ReactNode;
};

/**
 * DoubleClickHandler Component
 */
const DoubleClickHandler = ({
	onDoubleClick,
	onQuickCreate: _onQuickCreate,
	enabled = true,
	debounceMs = 300,
	showVisualFeedback = true,
	children,
}: DoubleClickHandlerProps) => {
	const reactFlowInstance = useReactFlow();
	const [indicator, setIndicator] = useState<{
		screen: Position;
		flow: Position;
	} | null>(null);
	const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastClickRef = useRef<number | null>(null);

	/**
	 * Handle pane click
	 */
	const handlePaneClick = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (!enabled) {
				return;
			}

			const now = Date.now();
			const lastClick = lastClickRef.current;

			// Check if this is a double-click
			if (lastClick && now - lastClick < debounceMs) {
				// Clear any pending timeout
				if (clickTimeoutRef.current) {
					clearTimeout(clickTimeoutRef.current);
					clickTimeoutRef.current = null;
				}

				// Get click position relative to React Flow pane
				const bounds = event.currentTarget.getBoundingClientRect();
				const screenPosition = {
					x: event.clientX - bounds.left,
					y: event.clientY - bounds.top,
				};

				// Convert to flow coordinates
				const flowPosition = screenToFlowPosition(
					screenPosition,
					reactFlowInstance
				);

				// Show visual feedback
				if (showVisualFeedback) {
					setIndicator({
						screen: screenPosition,
						flow: flowPosition,
					});

					// Hide indicator after animation
					setTimeout(() => {
						setIndicator(null);
					}, 600);
				}

				// Trigger double-click callback
				if (onDoubleClick) {
					onDoubleClick(flowPosition, event);
				}

				// Reset last click
				lastClickRef.current = null;
			} else {
				// First click, set last click time
				lastClickRef.current = now;

				// Set timeout to reset if no second click
				clickTimeoutRef.current = setTimeout(() => {
					lastClickRef.current = null;
					clickTimeoutRef.current = null;
				}, debounceMs);
			}
		},
		[enabled, debounceMs, showVisualFeedback, onDoubleClick, reactFlowInstance]
	);

	/**
	 * Handle keyboard shortcuts - placeholder for potential keyboard interactions
	 */
	const handleKeyDown = useCallback(
		(_event: React.KeyboardEvent<HTMLElement>) => {
			if (!enabled) {
				return;
			}
			// Keyboard shortcuts can be added here if needed
		},
		[enabled]
	);

	return (
		<>
			{/* Click handler overlay */}
			<button
				className="absolute inset-0 z-0 cursor-default border-none bg-transparent p-0"
				onClick={handlePaneClick}
				onKeyDown={handleKeyDown}
				type="button"
			>
				{children}
			</button>

			{/* Visual feedback indicator */}
			<AnimatePresence>
				{indicator && (
					<CreationIndicator
						onComplete={() => setIndicator(null)}
						position={indicator.screen}
					/>
				)}
			</AnimatePresence>
		</>
	);
};

type UseDoubleClickHandlerOptions = {
	onDoubleClick?: (position: Position, event: React.MouseEvent) => void;
	onQuickCreate?: (position: Position, event: React.MouseEvent) => void;
	enabled?: boolean;
	debounceMs?: number;
};

type UseDoubleClickHandlerReturn = {
	handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
	handleQuickCreate: (event: React.MouseEvent<HTMLDivElement>) => void;
	isProcessing: boolean;
};

/**
 * Hook for using double-click handler
 */
export const useDoubleClickHandler = ({
	onDoubleClick,
	onQuickCreate,
	enabled = true,
	debounceMs = 300,
}: UseDoubleClickHandlerOptions = {}): UseDoubleClickHandlerReturn => {
	const reactFlowInstance = useReactFlow();
	const [isProcessing, setIsProcessing] = useState(false);

	const handleDoubleClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!enabled || isProcessing) {
				return;
			}

			setIsProcessing(true);

			const bounds = event.currentTarget.getBoundingClientRect();
			const screenPosition = {
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
			};

			const flowPosition = screenToFlowPosition(
				screenPosition,
				reactFlowInstance
			);

			if (onDoubleClick) {
				onDoubleClick(flowPosition, event);
			}

			// Reset processing state after debounce
			setTimeout(() => {
				setIsProcessing(false);
			}, debounceMs);
		},
		[enabled, isProcessing, debounceMs, onDoubleClick, reactFlowInstance]
	);

	const handleQuickCreate = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!(enabled && event.shiftKey)) {
				return;
			}

			const bounds = event.currentTarget.getBoundingClientRect();
			const screenPosition = {
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
			};

			const flowPosition = screenToFlowPosition(
				screenPosition,
				reactFlowInstance
			);

			if (onQuickCreate) {
				onQuickCreate(flowPosition, event);
			}
		},
		[enabled, onQuickCreate, reactFlowInstance]
	);

	return {
		handleDoubleClick,
		handleQuickCreate,
		isProcessing,
	};
};

type WithDoubleClickHandlerProps = {
	onDoubleClick?: (position: Position, event: React.MouseEvent) => void;
	onQuickCreate?: (position: Position, event: React.MouseEvent) => void;
};

/**
 * Higher-order component to add double-click handling
 */
export const withDoubleClickHandler = <P extends object>(
	Component: React.ComponentType<P>
) =>
	React.forwardRef<unknown, P & WithDoubleClickHandlerProps>((props, ref) => {
		const { onDoubleClick, onQuickCreate, ...restProps } = props;

		return (
			<DoubleClickHandler
				onDoubleClick={onDoubleClick}
				onQuickCreate={onQuickCreate}
			>
				<Component ref={ref} {...(restProps as P)} />
			</DoubleClickHandler>
		);
	});

export default DoubleClickHandler;
