"use client";

/**
 * Transition Effects Component
 *
 * Page and component transition effects including:
 * - Page/section transitions
 * - Modal open/close effects
 * - Tab switching animations
 * - Accordion expand/collapse
 * - Crossfade transitions
 * - Morphing animations
 *
 * @component
 */

import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	COLLAPSE_ANIMATIONS,
	ENTRY_ANIMATIONS,
	MODAL_ANIMATIONS,
	SPRING,
	TIMING,
} from "./animation-presets";
import { useAnimation } from "./animation-provider";

// ========================================================================
// Types
// ========================================================================

type AnimationType = "fade" | "slideUp" | "slideDown" | "scale" | "slideScale";
type DrawerSide = "left" | "right" | "top" | "bottom";

type Tab = {
	id: string;
	label: string;
	content: React.ReactNode;
};

type PageTransitionProps = {
	children: React.ReactNode;
	animationType?: AnimationType;
	className?: string;
};

type ModalTransitionProps = {
	isOpen?: boolean;
	onClose?: () => void;
	children: React.ReactNode;
	className?: string;
};

type TabTransitionProps = {
	tabs?: Tab[];
	activeTab: string;
	onTabChange: (tabId: string) => void;
	className?: string;
};

type AccordionTransitionProps = {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	className?: string;
};

type CrossfadeTransitionProps = {
	children: React.ReactNode;
	transitionKey: string | number;
	className?: string;
};

type SlideDirection = "left" | "right" | "up" | "down";

type SlideTransitionProps = {
	children: React.ReactNode;
	direction?: SlideDirection;
	transitionKey: string | number;
	className?: string;
};

type MorphTransitionProps = {
	children: React.ReactNode;
	layoutId: string;
	className?: string;
};

type CollapseTransitionProps = {
	isOpen?: boolean;
	children: React.ReactNode;
	className?: string;
};

type DrawerTransitionProps = {
	isOpen?: boolean;
	onClose?: () => void;
	side?: DrawerSide;
	children: React.ReactNode;
	className?: string;
};

type FadeThroughTransitionProps = {
	children: React.ReactNode;
	transitionKey: string | number;
	className?: string;
};

// ========================================================================
// Page Transition Component
// ========================================================================

export const PageTransition = ({
	children,
	animationType = "fade",
	className = "",
}: PageTransitionProps) => {
	const { shouldAnimate, getVariants } = useAnimation();

	const animations = {
		fade: ENTRY_ANIMATIONS.fadeIn,
		slideUp: ENTRY_ANIMATIONS.slideInUp,
		slideDown: ENTRY_ANIMATIONS.slideInDown,
		scale: ENTRY_ANIMATIONS.scaleIn,
		slideScale: ENTRY_ANIMATIONS.slideScaleIn,
	};

	const variants = getVariants(animations[animationType] || animations.fade);

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			animate="animate"
			className={className}
			exit="exit"
			initial="initial"
			variants={variants}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Modal Transition Component
// ========================================================================

export const ModalTransition = ({
	isOpen = false,
	onClose,
	children,
	className = "",
}: ModalTransitionProps) => {
	const { getVariants } = useAnimation();

	const backdropVariants = getVariants(MODAL_ANIMATIONS.backdrop);
	const contentVariants = getVariants(MODAL_ANIMATIONS.content);

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						animate="animate"
						className={cn(
							"fixed",
							"inset-0",
							"bg-black/50",
							"backdrop-blur-xs",
							"z-50"
						)}
						exit="exit"
						initial="initial"
						onClick={onClose}
						variants={backdropVariants}
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<motion.div
							animate="animate"
							className={cn(
								"bg-background-transparent-black-secondaryAlt",
								"border",
								"border-border-transparent",
								"f-effect-backdrop-blur-lg",
								"rounded-xl",
								"shadow-3d",
								"max-w-lg",
								"w-full",
								"p-6",
								className
							)}
							exit="exit"
							initial="initial"
							variants={contentVariants}
						>
							{children}
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	);
};

// ========================================================================
// Tab Transition Component
// ========================================================================

export const TabTransition = ({
	tabs = [],
	activeTab,
	onTabChange,
	className = "",
}: TabTransitionProps) => {
	const { shouldAnimate, getVariants } = useAnimation();

	const contentVariants = getVariants({
		initial: { opacity: 0, x: -20 },
		animate: {
			opacity: 1,
			x: 0,
			transition: { duration: TIMING.normal / 1000, ease: "easeOut" },
		},
		exit: {
			opacity: 0,
			x: 20,
			transition: { duration: TIMING.fast / 1000, ease: "easeIn" },
		},
	});

	const activeTabContent = tabs.find((tab) => tab.id === activeTab);

	return (
		<div className={className}>
			<div className="mb-4 flex gap-2 border-border-transparent border-b">
				{tabs.map((tab) => (
					<button
						className={cn(
							"px-4",
							"py-2",
							"text-sm",
							"font-medium",
							"transition-colors",
							"relative",
							activeTab === tab.id
								? "text-text-light"
								: "text-text-light/50 hover:text-text-light/80"
						)}
						key={tab.id}
						onClick={() => onTabChange(tab.id)}
						type="button"
					>
						{tab.label}

						{activeTab === tab.id && (
							<motion.div
								className="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-500"
								layoutId="activeTab"
								transition={shouldAnimate ? SPRING.stiff : { duration: 0 }}
							/>
						)}
					</button>
				))}
			</div>

			<AnimatePresence mode="wait">
				{activeTabContent && (
					<motion.div
						animate="animate"
						exit="exit"
						initial="initial"
						key={activeTab}
						variants={shouldAnimate ? contentVariants : {}}
					>
						{activeTabContent.content}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

// ========================================================================
// Accordion Transition Component
// ========================================================================

export const AccordionTransition = ({
	title,
	children,
	defaultOpen = false,
	className = "",
}: AccordionTransitionProps) => {
	const { shouldAnimate, getVariants } = useAnimation();
	const [isOpen, setIsOpen] = useState(defaultOpen);

	const contentVariants = getVariants(COLLAPSE_ANIMATIONS.height);

	return (
		<div className={cn("border-border-transparent border-b", className)}>
			<button
				className={cn(
					"w-full",
					"flex",
					"items-center",
					"justify-between",
					"py-4",
					"text-left",
					"text-text-light",
					"hover:text-text-light/80",
					"transition-colors"
				)}
				onClick={() => setIsOpen(!isOpen)}
				type="button"
			>
				<span className="font-medium">{title}</span>
				<motion.svg
					animate={{ rotate: isOpen ? 180 : 0 }}
					aria-label={isOpen ? "Collapse" : "Expand"}
					fill="none"
					height="20"
					role="img"
					transition={shouldAnimate ? SPRING.default : { duration: 0 }}
					viewBox="0 0 20 20"
					width="20"
				>
					<title>{isOpen ? "Collapse" : "Expand"}</title>
					<path
						d="M5 7.5L10 12.5L15 7.5"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
					/>
				</motion.svg>
			</button>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						animate="expanded"
						exit="collapsed"
						initial="collapsed"
						variants={shouldAnimate ? contentVariants : {}}
					>
						<div className="pb-4">{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

// ========================================================================
// Crossfade Transition Component
// ========================================================================

export const CrossfadeTransition = ({
	children,
	transitionKey,
	className = "",
}: CrossfadeTransitionProps) => {
	const { shouldAnimate, getDuration } = useAnimation();

	const variants = {
		initial: { opacity: 0 },
		animate: {
			opacity: 1,
			transition: { duration: getDuration(TIMING.normal) / 1000 },
		},
		exit: {
			opacity: 0,
			transition: { duration: getDuration(TIMING.fast) / 1000 },
		},
	};

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<AnimatePresence mode="wait">
			<motion.div
				animate="animate"
				className={className}
				exit="exit"
				initial="initial"
				key={transitionKey}
				variants={variants}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
};

// ========================================================================
// Slide Transition Component
// ========================================================================

export const SlideTransition = ({
	children,
	direction = "left",
	transitionKey,
	className = "",
}: SlideTransitionProps) => {
	const { shouldAnimate } = useAnimation();

	const directions = {
		left: { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "-100%" } },
		right: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "100%" } },
		up: { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "-100%" } },
		down: { initial: { y: "-100%" }, animate: { y: 0 }, exit: { y: "100%" } },
	};

	const variants = directions[direction];

	const transition = {
		type: "spring" as const,
		stiffness: 300,
		damping: 30,
	};

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<AnimatePresence mode="wait">
			<motion.div
				animate={variants.animate}
				className={className}
				exit={variants.exit}
				initial={variants.initial}
				key={transitionKey}
				transition={transition}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
};

// ========================================================================
// Morphing Transition Component
// ========================================================================

export const MorphTransition = ({
	children,
	layoutId,
	className = "",
}: MorphTransitionProps) => {
	const { shouldAnimate } = useAnimation();

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			className={className}
			layout
			layoutId={layoutId}
			transition={SPRING.default}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Collapse Transition Component
// ========================================================================

export const CollapseTransition = ({
	isOpen = true,
	children,
	className = "",
}: CollapseTransitionProps) => {
	const { shouldAnimate, getVariants } = useAnimation();

	const variants = getVariants(COLLAPSE_ANIMATIONS.height);

	if (!shouldAnimate) {
		return isOpen ? <div className={className}>{children}</div> : null;
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					animate="expanded"
					className={className}
					exit="collapsed"
					initial="collapsed"
					variants={variants}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
};

// ========================================================================
// Drawer Transition Component
// ========================================================================

export const DrawerTransition = ({
	isOpen = false,
	onClose,
	side = "right",
	children,
	className = "",
}: DrawerTransitionProps) => {
	const { getVariants } = useAnimation();

	const backdropVariants = getVariants(MODAL_ANIMATIONS.backdrop);

	const slideVariants = {
		left: {
			initial: { x: "-100%" },
			animate: { x: 0 },
			exit: { x: "-100%" },
		},
		right: {
			initial: { x: "100%" },
			animate: { x: 0 },
			exit: { x: "100%" },
		},
		top: {
			initial: { y: "-100%" },
			animate: { y: 0 },
			exit: { y: "-100%" },
		},
		bottom: {
			initial: { y: "100%" },
			animate: { y: 0 },
			exit: { y: "100%" },
		},
	};

	const contentVariants = getVariants({
		...slideVariants[side],
		transition: SPRING.default,
	});

	const positions = {
		left: "left-0 top-0 bottom-0",
		right: "right-0 top-0 bottom-0",
		top: "top-0 left-0 right-0",
		bottom: "bottom-0 left-0 right-0",
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						animate="animate"
						className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
						exit="exit"
						initial="initial"
						onClick={onClose}
						variants={backdropVariants}
					/>

					<motion.div
						animate="animate"
						className={cn(
							"fixed",
							"z-50",
							"bg-background-transparent-black-secondaryAlt",
							"border",
							"border-border-transparent",
							"f-effect-backdrop-blur-lg",
							"shadow-3d",
							positions[side],
							side === "left" || side === "right"
								? "w-80 max-w-[80vw]"
								: "h-80 max-h-[80vh]",
							className
						)}
						exit="exit"
						initial="initial"
						variants={contentVariants}
					>
						{children}
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};

// ========================================================================
// Fade Through Transition Component
// ========================================================================

export const FadeThroughTransition = ({
	children,
	transitionKey,
	className = "",
}: FadeThroughTransitionProps) => {
	const { shouldAnimate, getDuration } = useAnimation();

	const variants = {
		initial: { opacity: 0, scale: 0.95 },
		animate: {
			opacity: 1,
			scale: 1,
			transition: {
				duration: getDuration(TIMING.normal) / 1000,
				ease: "easeOut" as const,
			},
		},
		exit: {
			opacity: 0,
			scale: 0.95,
			transition: {
				duration: getDuration(TIMING.fast) / 1000,
				ease: "easeIn" as const,
			},
		},
	};

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<AnimatePresence mode="wait">
			<motion.div
				animate="animate"
				className={className}
				exit="exit"
				initial="initial"
				key={transitionKey}
				variants={variants}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
};

// ========================================================================
// Export All
// ========================================================================

export default {
	PageTransition,
	ModalTransition,
	TabTransition,
	AccordionTransition,
	CrossfadeTransition,
	SlideTransition,
	MorphTransition,
	CollapseTransition,
	DrawerTransition,
	FadeThroughTransition,
};
