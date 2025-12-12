"use client";

/**
 * Animation System Demo
 *
 * Comprehensive demonstration of all animation components and capabilities.
 * Shows off spring animations, loading states, micro-interactions, and transitions.
 *
 * @component
 */

import { Heart, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { AnimationProvider, useAnimation } from "./animation-provider";
import {
	CircularProgress,
	ContentReveal,
	DotsLoader,
	NodeSkeleton,
	ProgressBar,
	PulseLoader,
	ShimmerContainer,
	Skeleton,
	Spinner,
} from "./loading-states";
import {
	AnimatedCounter,
	AnimatedTooltip,
	BadgePulse,
	BounceIcon,
	FeedbackToast,
	InteractiveButton,
	RippleEffect,
	RotatingIcon,
	Shake,
	SuccessCheckmark,
	Wiggle,
} from "./micro-interactions";
import {
	SpringDraggable,
	SpringGesture,
	SpringMagnetic,
	SpringRotate,
	SpringScale,
	SpringStaggerContainer,
	SpringStaggerItem,
} from "./spring-animations";
import {
	AccordionTransition,
	CrossfadeTransition,
	DrawerTransition,
	ModalTransition,
	TabTransition,
} from "./transition-effects";

// ========================================================================
// Types
// ========================================================================

type DemoSectionProps = {
	title: string;
	description?: string;
	children: React.ReactNode;
};

type Tab = {
	id: string;
	label: string;
	content: React.ReactNode;
};

type ToastType = "success" | "error" | "warning" | "info";
type PerformanceScore = "excellent" | "good" | "fair" | "poor";
type AnimationSpeed = "slow" | "normal" | "fast";

// ========================================================================
// Demo Section Component
// ========================================================================

const DemoSection = ({ title, description, children }: DemoSectionProps) => (
	<div className="space-y-4">
		<div>
			<h3 className="font-semibold text-lg text-text-light">{title}</h3>
			{description && (
				<p className="mt-1 text-sm text-text-light/60">{description}</p>
			)}
		</div>
		<div className="rounded-xl border border-border-transparent bg-background-transparent-black p-6">
			{children}
		</div>
	</div>
);

// ========================================================================
// Animation Controls Component
// ========================================================================

const AnimationControls = () => {
	const {
		animationsEnabled,
		animationSpeed,
		reducedMotion,
		fps,
		performanceScore,
		toggleAnimations,
		setSpeed,
		setReducedMotion,
	} = useAnimation();

	const getPerformanceColor = (score: PerformanceScore) => {
		const colors: Record<PerformanceScore, string> = {
			excellent: "text-green-400",
			good: "text-blue-400",
			fair: "text-yellow-400",
			poor: "text-red-400",
		};
		return colors[score];
	};

	return (
		<div className="space-y-4 rounded-xl border border-border-transparent bg-background-transparent-black p-6">
			<h3 className="font-semibold text-lg text-text-light">
				Animation Controls
			</h3>

			<div className="flex items-center justify-between">
				<span className="text-sm text-text-light">Animations Enabled</span>
				<button
					className={cn(
						"rounded-lg px-4 py-2 font-medium text-sm transition-colors",
						animationsEnabled
							? "bg-green-600 text-white"
							: "bg-gray-700 text-text-light"
					)}
					onClick={toggleAnimations}
					type="button"
				>
					{animationsEnabled ? "On" : "Off"}
				</button>
			</div>

			<div className="space-y-2">
				<span className="text-sm text-text-light">Animation Speed</span>
				<div className="flex gap-2">
					{(["slow", "normal", "fast"] as AnimationSpeed[]).map((speed) => (
						<button
							className={cn(
								"flex-1 rounded-lg px-4 py-2 font-medium text-sm transition-colors",
								animationSpeed === speed
									? "bg-blue-600 text-white"
									: "bg-gray-700 text-text-light hover:bg-gray-600"
							)}
							key={speed}
							onClick={() => setSpeed(speed)}
							type="button"
						>
							{speed.charAt(0).toUpperCase() + speed.slice(1)}
						</button>
					))}
				</div>
			</div>

			<div className="flex items-center justify-between">
				<span className="text-sm text-text-light">Reduced Motion</span>
				<button
					className={cn(
						"rounded-lg px-4 py-2 font-medium text-sm transition-colors",
						reducedMotion
							? "bg-orange-600 text-white"
							: "bg-gray-700 text-text-light"
					)}
					onClick={() => setReducedMotion(!reducedMotion)}
					type="button"
				>
					{reducedMotion ? "On" : "Off"}
				</button>
			</div>

			<div className="space-y-2 border-border-transparent border-t pt-4">
				<span className="font-medium text-sm text-text-light">Performance</span>
				<div className="flex items-center justify-between text-sm">
					<span className="text-text-light/60">FPS</span>
					<span className="font-mono text-text-light">{fps}</span>
				</div>
				<div className="flex items-center justify-between text-sm">
					<span className="text-text-light/60">Score</span>
					<span
						className={cn("font-medium", getPerformanceColor(performanceScore))}
					>
						{performanceScore}
					</span>
				</div>
			</div>
		</div>
	);
};

// ========================================================================
// Spring Animations Demo
// ========================================================================

const SpringAnimationsDemo = () => (
	<DemoSection
		description="Physics-based animations with natural motion"
		title="Spring Animations"
	>
		<div className="space-y-6">
			<div>
				<h4 className="mb-3 font-medium text-sm text-text-light">
					Stagger Effect
				</h4>
				<SpringStaggerContainer className="flex gap-2">
					{[1, 2, 3, 4, 5].map((i) => (
						<SpringStaggerItem
							className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-600 font-bold text-white"
							key={i}
						>
							{i}
						</SpringStaggerItem>
					))}
				</SpringStaggerContainer>
			</div>

			<div className="grid grid-cols-3 gap-4">
				<SpringGesture className="rounded-lg bg-purple-600 p-4 text-center text-white">
					Hover Me
				</SpringGesture>
				<SpringScale
					className="rounded-lg bg-green-600 p-4 text-center text-white"
					scale={1.5}
				>
					Scaled
				</SpringScale>
				<SpringRotate
					className="rounded-lg bg-orange-600 p-4 text-center text-white"
					rotation={45}
				>
					Rotated
				</SpringRotate>
			</div>

			<div>
				<h4 className="mb-3 font-medium text-sm text-text-light">
					Draggable (with spring return)
				</h4>
				<div className="relative h-32 rounded-lg border-2 border-border-transparent border-dashed">
					<SpringDraggable
						className="absolute top-1/2 left-1/2 flex h-20 w-20 cursor-grab items-center justify-center rounded-lg bg-blue-600 font-bold text-white active:cursor-grabbing"
						constraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
					>
						Drag
					</SpringDraggable>
				</div>
			</div>

			<div>
				<h4 className="mb-3 font-medium text-sm text-text-light">
					Magnetic Effect
				</h4>
				<SpringMagnetic
					className="inline-block rounded-lg bg-pink-600 p-6 font-bold text-white"
					strength={0.5}
				>
					Follow Me
				</SpringMagnetic>
			</div>
		</div>
	</DemoSection>
);

// ========================================================================
// Loading States Demo
// ========================================================================

const LoadingStatesDemo = () => {
	const [progress, setProgress] = useState(45);
	const [isLoading, setIsLoading] = useState(true);

	return (
		<DemoSection
			description="Skeleton loaders, spinners, and progress indicators"
			title="Loading States"
		>
			<div className="space-y-6">
				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">Spinners</h4>
					<div className="flex items-center gap-6">
						<Spinner size={24} />
						<Spinner size={32} />
						<Spinner size={48} />
						<DotsLoader />
						<PulseLoader />
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Progress Indicators
					</h4>
					<div className="space-y-4">
						<ProgressBar progress={progress} showLabel />
						<CircularProgress progress={progress} showLabel />
						<div className="flex gap-2">
							<button
								className="rounded bg-gray-700 px-3 py-1 text-sm"
								onClick={() => setProgress(Math.max(0, progress - 10))}
								type="button"
							>
								-10%
							</button>
							<button
								className="rounded bg-gray-700 px-3 py-1 text-sm"
								onClick={() => setProgress(Math.min(100, progress + 10))}
								type="button"
							>
								+10%
							</button>
						</div>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Skeleton Loaders
					</h4>
					<div className="space-y-3">
						<Skeleton variant="title" />
						<Skeleton count={3} variant="text" />
						<div className="flex gap-3">
							<Skeleton variant="avatar" />
							<Skeleton variant="button" />
						</div>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Node Skeleton
					</h4>
					<div className="flex gap-4">
						<NodeSkeleton />
						<NodeSkeleton expanded />
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Shimmer Effect
					</h4>
					<ShimmerContainer isLoading={isLoading}>
						<div className="rounded-lg bg-gray-800 p-4">
							<p className="text-text-light">Content with shimmer overlay</p>
						</div>
					</ShimmerContainer>
					<button
						className="mt-2 rounded bg-gray-700 px-3 py-1 text-sm"
						onClick={() => setIsLoading(!isLoading)}
						type="button"
					>
						Toggle Loading
					</button>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Content Reveal
					</h4>
					<ContentReveal isLoading={false}>
						<div className="rounded-lg bg-gray-800 p-4">
							<p className="text-text-light">Content revealed with animation</p>
						</div>
					</ContentReveal>
				</div>
			</div>
		</DemoSection>
	);
};

// ========================================================================
// Micro Interactions Demo
// ========================================================================

const MicroInteractionsDemo = () => {
	const [count, setCount] = useState(42);
	const [shakeKey, setShakeKey] = useState(0);
	const [wiggleKey, setWiggleKey] = useState(0);
	const [toastVisible, setToastVisible] = useState(false);
	const [toastType, setToastType] = useState<ToastType>("success");
	const [checkVisible, setCheckVisible] = useState(false);

	return (
		<DemoSection
			description="Delightful UI feedback animations"
			title="Micro Interactions"
		>
			<div className="space-y-6">
				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Interactive Buttons
					</h4>
					<div className="flex gap-2">
						<InteractiveButton variant="primary">Primary</InteractiveButton>
						<InteractiveButton variant="secondary">Secondary</InteractiveButton>
						<InteractiveButton variant="ghost">Ghost</InteractiveButton>
						<InteractiveButton variant="success">Success</InteractiveButton>
						<InteractiveButton variant="danger">Danger</InteractiveButton>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Ripple Effect
					</h4>
					<RippleEffect className="inline-block cursor-pointer rounded-lg bg-blue-600 p-4 text-white">
						Click for Ripple
					</RippleEffect>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Animated Focus Ring
					</h4>
					<input
						className="rounded-lg bg-gray-800 px-4 py-2 text-text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="Focus me"
						type="text"
					/>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Feedback Toasts
					</h4>
					<div className="mb-4 flex gap-2">
						{(["success", "error", "warning", "info"] as ToastType[]).map(
							(type) => (
								<button
									className="rounded bg-gray-700 px-3 py-1 text-sm capitalize"
									key={type}
									onClick={() => {
										setToastType(type);
										setToastVisible(true);
									}}
									type="button"
								>
									{type}
								</button>
							)
						)}
					</div>
					<FeedbackToast
						isVisible={toastVisible}
						message={`This is a ${toastType} message!`}
						onDismiss={() => setToastVisible(false)}
						type={toastType}
					/>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Success Checkmark
					</h4>
					<div className="flex items-center gap-4">
						<SuccessCheckmark isVisible={checkVisible} size={64} />
						<button
							className="rounded bg-gray-700 px-3 py-1 text-sm"
							onClick={() => setCheckVisible(!checkVisible)}
							type="button"
						>
							Toggle
						</button>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Animated Counter
					</h4>
					<div className="flex items-center gap-4">
						<div className="font-bold text-4xl text-blue-400">
							<AnimatedCounter duration={1} value={count} />
						</div>
						<div className="flex gap-2">
							<button
								className="rounded bg-gray-700 px-3 py-1 text-sm"
								onClick={() => setCount(count - 10)}
								type="button"
							>
								-10
							</button>
							<button
								className="rounded bg-gray-700 px-3 py-1 text-sm"
								onClick={() => setCount(count + 10)}
								type="button"
							>
								+10
							</button>
						</div>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Animated Icons
					</h4>
					<div className="flex gap-4">
						<RotatingIcon className="h-8 w-8 text-blue-400" icon={Settings} />
						<BounceIcon className="h-8 w-8 text-pink-400" icon={Heart} />
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Shake & Wiggle
					</h4>
					<div className="flex gap-4">
						<Shake className="inline-block" trigger={shakeKey > 0}>
							<button
								className="rounded-lg bg-red-600 px-4 py-2"
								onClick={() => setShakeKey(shakeKey + 1)}
								type="button"
							>
								Shake Me
							</button>
						</Shake>
						<Wiggle className="inline-block" trigger={wiggleKey > 0}>
							<button
								className="rounded-lg bg-purple-600 px-4 py-2"
								onClick={() => setWiggleKey(wiggleKey + 1)}
								type="button"
							>
								Wiggle Me
							</button>
						</Wiggle>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Animated Tooltip
					</h4>
					<AnimatedTooltip content="This is a tooltip!" position="top">
						<button className="rounded-lg bg-gray-700 px-4 py-2" type="button">
							Hover for Tooltip
						</button>
					</AnimatedTooltip>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Badge Pulse
					</h4>
					<div className="inline-flex items-center gap-2">
						<span className="text-text-light">Notifications</span>
						<BadgePulse count={5} pulse />
					</div>
				</div>
			</div>
		</DemoSection>
	);
};

// ========================================================================
// Transition Effects Demo
// ========================================================================

const TransitionEffectsDemo = () => {
	const [activeTab, setActiveTab] = useState("tab1");
	const [modalOpen, setModalOpen] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [crossfadeKey, setCrossfadeKey] = useState(0);

	const tabs: Tab[] = [
		{
			id: "tab1",
			label: "Tab 1",
			content: (
				<div className="rounded-lg bg-gray-800 p-4">Content for Tab 1</div>
			),
		},
		{
			id: "tab2",
			label: "Tab 2",
			content: (
				<div className="rounded-lg bg-gray-800 p-4">Content for Tab 2</div>
			),
		},
		{
			id: "tab3",
			label: "Tab 3",
			content: (
				<div className="rounded-lg bg-gray-800 p-4">Content for Tab 3</div>
			),
		},
	];

	return (
		<DemoSection
			description="Smooth transitions for UI state changes"
			title="Transition Effects"
		>
			<div className="space-y-6">
				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Tab Transition
					</h4>
					<TabTransition
						activeTab={activeTab}
						onTabChange={setActiveTab}
						tabs={tabs}
					/>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Accordion
					</h4>
					<div className="space-y-2">
						<AccordionTransition title="Accordion Item 1">
							<p className="text-text-light/70">Content for accordion item 1</p>
						</AccordionTransition>
						<AccordionTransition title="Accordion Item 2">
							<p className="text-text-light/70">Content for accordion item 2</p>
						</AccordionTransition>
					</div>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Crossfade Transition
					</h4>
					<CrossfadeTransition transitionKey={crossfadeKey}>
						<div className="rounded-lg bg-gray-800 p-4">
							State: {crossfadeKey}
						</div>
					</CrossfadeTransition>
					<button
						className="mt-2 rounded bg-gray-700 px-3 py-1 text-sm"
						onClick={() => setCrossfadeKey(crossfadeKey + 1)}
						type="button"
					>
						Change State
					</button>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Modal Transition
					</h4>
					<button
						className="rounded-lg bg-blue-600 px-4 py-2"
						onClick={() => setModalOpen(true)}
						type="button"
					>
						Open Modal
					</button>
					<ModalTransition
						isOpen={modalOpen}
						onClose={() => setModalOpen(false)}
					>
						<h3 className="mb-4 font-semibold text-lg text-text-light">
							Modal Title
						</h3>
						<p className="text-text-light/70">
							This is modal content with smooth animations.
						</p>
						<button
							className="mt-4 rounded-lg bg-gray-700 px-4 py-2"
							onClick={() => setModalOpen(false)}
							type="button"
						>
							Close
						</button>
					</ModalTransition>
				</div>

				<div>
					<h4 className="mb-3 font-medium text-sm text-text-light">
						Drawer Transition
					</h4>
					<button
						className="rounded-lg bg-purple-600 px-4 py-2"
						onClick={() => setDrawerOpen(true)}
						type="button"
					>
						Open Drawer
					</button>
					<DrawerTransition
						isOpen={drawerOpen}
						onClose={() => setDrawerOpen(false)}
						side="right"
					>
						<div className="p-6">
							<h3 className="mb-4 font-semibold text-lg text-text-light">
								Drawer
							</h3>
							<p className="text-text-light/70">This is drawer content.</p>
							<button
								className="mt-4 rounded-lg bg-gray-700 px-4 py-2"
								onClick={() => setDrawerOpen(false)}
								type="button"
							>
								Close
							</button>
						</div>
					</DrawerTransition>
				</div>
			</div>
		</DemoSection>
	);
};

// ========================================================================
// Main Demo Component
// ========================================================================

export const AnimationDemo = () => (
	<AnimationProvider enablePerformanceMonitoring>
		<div className="min-h-screen bg-gray-950 p-8">
			<div className="mx-auto max-w-7xl space-y-8">
				<div className="space-y-2 text-center">
					<h1 className="font-bold text-4xl text-text-light">
						Animation System Demo
					</h1>
					<p className="text-text-light/60">
						Comprehensive showcase of all animation components and capabilities
					</p>
				</div>

				<AnimationControls />

				<SpringAnimationsDemo />
				<LoadingStatesDemo />
				<MicroInteractionsDemo />
				<TransitionEffectsDemo />
			</div>
		</div>
	</AnimationProvider>
);

export default AnimationDemo;
