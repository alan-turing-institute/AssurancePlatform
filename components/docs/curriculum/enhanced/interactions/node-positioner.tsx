"use client";

/**
 * Node Positioner Component
 *
 * Smart positioning system for new nodes with overlap avoidance,
 * grid snapping, alignment guides, and connection previews.
 *
 * Features:
 * - Smart positioning to avoid overlaps
 * - Grid snapping option
 * - Alignment guides (visual indicators)
 * - Auto-arrange after creation
 * - Connection preview while positioning
 * - Magnetic edges for alignment
 *
 * @component
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlignHorizontalDistributeCenter, Grid3x3, Magnet } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { Node } from "reactflow";
import { useNodes, useReactFlow } from "reactflow";
import { cn } from "@/lib/utils";
import {
	calculateConnectionHints,
	calculateDistance,
	calculateSmartPosition,
	findNonOverlappingPosition,
	snapToGrid,
} from "./creation-utils";

type Position = {
	x: number;
	y: number;
};

type AlignmentGuides = {
	horizontal: number | null;
	vertical: number | null;
};

type AlignmentGuideProps = {
	position: Position;
	type: "horizontal" | "vertical";
	isVisible: boolean;
};

/**
 * Alignment Guide Component
 */
const AlignmentGuide = ({ position, type, isVisible }: AlignmentGuideProps) => {
	if (!isVisible) {
		return null;
	}

	const isHorizontal = type === "horizontal";

	return (
		<motion.div
			animate={{ opacity: 0.6 }}
			className={cn(
				"pointer-events-none absolute z-50",
				"bg-blue-400",
				isHorizontal ? "left-0 h-px w-screen" : "top-0 h-screen w-px"
			)}
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			style={isHorizontal ? { top: position.y } : { left: position.x }}
			transition={{ duration: 0.2 }}
		/>
	);
};

type GridOverlayProps = {
	visible: boolean;
	gridSize?: number;
};

/**
 * Grid Overlay Component
 */
const GridOverlay = ({ visible, gridSize = 20 }: GridOverlayProps) => {
	if (!visible) {
		return null;
	}

	return (
		<motion.div
			animate={{ opacity: 0.3 }}
			className="pointer-events-none absolute inset-0 z-40"
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			style={{
				backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
				backgroundSize: `${gridSize}px ${gridSize}px`,
			}}
		/>
	);
};

type ConnectionPreviewProps = {
	start: Position;
	end: Position;
	isVisible: boolean;
};

/**
 * Connection Preview Component
 */
const _ConnectionPreview = ({
	start,
	end,
	isVisible,
}: ConnectionPreviewProps) => {
	if (!(isVisible && start && end)) {
		return null;
	}

	const distance = calculateDistance(start, end);
	const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);

	return (
		<motion.div
			animate={{ opacity: 0.6 }}
			className="pointer-events-none absolute z-40"
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			style={{
				left: start.x,
				top: start.y,
				width: distance,
				height: 2,
				transformOrigin: "left center",
				transform: `rotate(${angle}deg)`,
				background:
					"linear-gradient(to right, rgba(59, 130, 246, 0.6), rgba(59, 130, 246, 0.2))",
			}}
		/>
	);
};

type GhostNodePreviewProps = {
	position: Position | null;
	nodeType: string;
	isVisible: boolean;
};

/**
 * Ghost Node Preview Component
 */
const GhostNodePreview = ({
	position,
	nodeType,
	isVisible,
}: GhostNodePreviewProps) => {
	if (!(isVisible && position)) {
		return null;
	}

	return (
		<motion.div
			animate={{ opacity: 0.5, scale: 1 }}
			className={cn(
				"pointer-events-none absolute z-50",
				"h-[150px] w-[300px]",
				"rounded-xl",
				"border-2 border-blue-400 border-dashed",
				"bg-blue-500/10",
				"backdrop-blur-sm",
				"flex items-center justify-center"
			)}
			exit={{ opacity: 0, scale: 0.8 }}
			initial={{ opacity: 0, scale: 0.8 }}
			style={{
				left: position.x,
				top: position.y,
				transform: "translate(-50%, -50%)",
			}}
		>
			<div className="font-semibold text-blue-400 text-sm">{nodeType}</div>
		</motion.div>
	);
};

type MagneticSnapIndicatorProps = {
	position: Position | null;
	isSnapping: boolean;
};

/**
 * Magnetic Snap Indicator
 */
const MagneticSnapIndicator = ({
	position,
	isSnapping,
}: MagneticSnapIndicatorProps) => {
	if (!(isSnapping && position)) {
		return null;
	}

	return (
		<motion.div
			animate={{ scale: 1 }}
			className="pointer-events-none absolute z-50"
			exit={{ scale: 0 }}
			initial={{ scale: 0 }}
			style={{
				left: position.x,
				top: position.y,
				transform: "translate(-50%, -50%)",
			}}
		>
			<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/50">
				<Magnet className="h-4 w-4 text-blue-400" />
			</div>
		</motion.div>
	);
};

type UseNodePositionerOptions = {
	gridSize?: number;
	snapThreshold?: number;
	magneticThreshold?: number;
	showGuides?: boolean;
	showGrid?: boolean;
	showPreview?: boolean;
};

type CalculateOptimalPositionOptions = {
	enableGridSnap?: boolean;
	enableMagneticSnap?: boolean;
	enableOverlapAvoidance?: boolean;
	sourceNode?: Node | null;
};

type UseNodePositionerReturn = {
	calculateOptimalPosition: (
		basePosition: Position,
		options?: CalculateOptimalPositionOptions
	) => Position;
	getConnectionHints: (position: Position) => Array<{
		nodeId: string;
		nodeName: string;
		direction: string;
		distance: number;
	}>;
	autoArrange: (algorithm?: "hierarchical") => void;
	isDragging: boolean;
	setIsDragging: (value: boolean) => void;
	currentPosition: Position | null;
	setCurrentPosition: (value: Position | null) => void;
	snappedPosition: Position | null;
	setSnappedPosition: (value: Position | null) => void;
	alignmentGuides: AlignmentGuides;
	isSnapping: boolean;
};

/**
 * Node Positioner Hook
 */
export const useNodePositioner = ({
	gridSize = 20,
	snapThreshold = 10,
	magneticThreshold: _magneticThreshold = 20,
	showGuides = true,
	showGrid: _showGrid = false,
	showPreview: _showPreview = true,
}: UseNodePositionerOptions = {}): UseNodePositionerReturn => {
	const reactFlowInstance = useReactFlow();
	const nodes = useNodes();
	const [isDragging, setIsDragging] = useState(false);
	const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
	const [snappedPosition, setSnappedPosition] = useState<Position | null>(null);
	const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuides>({
		horizontal: null,
		vertical: null,
	});
	const [isSnapping, setIsSnapping] = useState(false);

	/**
	 * Find alignment guides for position
	 */
	const findAlignmentGuides = useCallback(
		(position: Position): AlignmentGuides => {
			if (!showGuides) {
				return { horizontal: null, vertical: null };
			}

			const guides: AlignmentGuides = { horizontal: null, vertical: null };

			for (const node of nodes) {
				const nodeCenter = {
					x: node.position.x + (node.width || 300) / 2,
					y: node.position.y + (node.height || 150) / 2,
				};

				// Check horizontal alignment
				if (Math.abs(position.y - nodeCenter.y) < snapThreshold) {
					guides.horizontal = nodeCenter.y;
				}

				// Check vertical alignment
				if (Math.abs(position.x - nodeCenter.x) < snapThreshold) {
					guides.vertical = nodeCenter.x;
				}
			}

			return guides;
		},
		[nodes, showGuides, snapThreshold]
	);

	/**
	 * Apply magnetic snapping to position
	 */
	const applyMagneticSnapping = useCallback(
		(position: Position): Position => {
			const guides = findAlignmentGuides(position);
			const result = { ...position };

			if (guides.horizontal !== null) {
				result.y = guides.horizontal;
			}
			if (guides.vertical !== null) {
				result.x = guides.vertical;
			}

			setIsSnapping(guides.horizontal !== null || guides.vertical !== null);
			setAlignmentGuides(guides);

			return result;
		},
		[findAlignmentGuides]
	);

	/**
	 * Calculate optimal position with all features
	 */
	const calculateOptimalPosition = useCallback(
		(
			basePosition: Position,
			options: CalculateOptimalPositionOptions = {}
		): Position => {
			const {
				enableGridSnap = true,
				enableMagneticSnap = true,
				enableOverlapAvoidance = true,
				sourceNode = null,
			} = options;

			let position = { ...basePosition };

			if (enableGridSnap) {
				position = snapToGrid(position, gridSize);
			}

			if (enableMagneticSnap) {
				position = applyMagneticSnapping(position);
			}

			if (enableOverlapAvoidance) {
				position = findNonOverlappingPosition(position, nodes);
			}

			if (sourceNode) {
				position = calculateSmartPosition([sourceNode], nodes);
			}

			return position;
		},
		[nodes, gridSize, applyMagneticSnapping]
	);

	/**
	 * Get connection hints for position
	 */
	const getConnectionHints = useCallback(
		(position: Position) => calculateConnectionHints(position, nodes),
		[nodes]
	);

	/**
	 * Auto-arrange nodes
	 */
	const autoArrange = useCallback(
		(algorithm: "hierarchical" = "hierarchical") => {
			// Simple hierarchical layout
			if (algorithm === "hierarchical") {
				const sortedNodes = [...nodes].sort((_a, _b) => {
					// Sort by dependencies (nodes with no incoming edges first)
					return 0; // Simplified for now
				});

				const currentY = 100;
				const levelSpacing = 200;
				const nodeSpacing = 350;

				for (const [index, node] of sortedNodes.entries()) {
					const x = (index % 4) * nodeSpacing + 100;
					const y = Math.floor(index / 4) * levelSpacing + currentY;

					reactFlowInstance.setNodes((nds) =>
						nds.map((n) =>
							n.id === node.id ? { ...n, position: { x, y } } : n
						)
					);
				}
			}
		},
		[nodes, reactFlowInstance]
	);

	return {
		calculateOptimalPosition,
		getConnectionHints,
		autoArrange,
		isDragging,
		setIsDragging,
		currentPosition,
		setCurrentPosition,
		snappedPosition,
		setSnappedPosition,
		alignmentGuides,
		isSnapping,
	};
};

type NodePositionerProps = {
	nodeType: string;
	basePosition: Position | null;
	onPositionChange?: (position: Position) => void;
	showControls?: boolean;
	children?: ReactNode;
	className?: string;
};

/**
 * Node Positioner Component
 */
const NodePositioner = ({
	nodeType,
	basePosition,
	onPositionChange,
	showControls = true,
	children,
	className,
}: NodePositionerProps) => {
	const { calculateOptimalPosition, autoArrange, alignmentGuides, isSnapping } =
		useNodePositioner();

	const [gridVisible, setGridVisible] = useState(false);
	const [previewPosition, setPreviewPosition] = useState<Position | null>(null);

	useEffect(() => {
		if (basePosition) {
			const optimal = calculateOptimalPosition(basePosition);
			setPreviewPosition(optimal);
			if (onPositionChange) {
				onPositionChange(optimal);
			}
		}
	}, [basePosition, calculateOptimalPosition, onPositionChange]);

	return (
		<div className={cn("relative", className)}>
			{/* Controls */}
			{showControls && (
				<div className="absolute top-4 right-4 z-50 flex gap-2">
					<motion.button
						className={cn(
							"rounded-lg p-2",
							"bg-background-transparent-black",
							"backdrop-blur-lg",
							"border border-transparent",
							"hover:bg-background-transparent-white-hover",
							"transition-all duration-200",
							gridVisible && "bg-blue-500/20"
						)}
						onClick={() => setGridVisible(!gridVisible)}
						title="Toggle Grid"
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
					>
						<Grid3x3 className="h-4 w-4 text-text-light" />
					</motion.button>

					<motion.button
						className={cn(
							"rounded-lg p-2",
							"bg-background-transparent-black",
							"backdrop-blur-lg",
							"border border-transparent",
							"hover:bg-background-transparent-white-hover",
							"transition-all duration-200"
						)}
						onClick={() => autoArrange()}
						title="Auto Arrange"
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
					>
						<AlignHorizontalDistributeCenter className="h-4 w-4 text-text-light" />
					</motion.button>
				</div>
			)}

			{/* Visual Aids */}
			<GridOverlay visible={gridVisible} />

			<AnimatePresence>
				<AlignmentGuide
					isVisible={alignmentGuides.horizontal !== null}
					position={{ y: alignmentGuides.horizontal || 0, x: 0 }}
					type="horizontal"
				/>
				<AlignmentGuide
					isVisible={alignmentGuides.vertical !== null}
					position={{ x: alignmentGuides.vertical || 0, y: 0 }}
					type="vertical"
				/>
			</AnimatePresence>

			<AnimatePresence>
				<GhostNodePreview
					isVisible={!!previewPosition}
					nodeType={nodeType}
					position={previewPosition}
				/>
			</AnimatePresence>

			<AnimatePresence>
				<MagneticSnapIndicator
					isSnapping={isSnapping}
					position={previewPosition}
				/>
			</AnimatePresence>

			{children}
		</div>
	);
};

export default NodePositioner;
