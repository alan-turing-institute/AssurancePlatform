"use client";
/**
 * Animation Provider
 *
 * Global animation context provider with user preferences, performance monitoring,
 * and accessibility support (reduced motion).
 *
 * Features:
 * - User preference for reduced motion
 * - Animation speed controls (slow, normal, fast)
 * - Disable animations option
 * - FPS monitoring and performance optimization
 * Global animation state management
 *
 * @component
 */

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { PERFORMANCE } from "./animation-presets";

// ========================================================================
// Types
// ========================================================================

type AnimationSpeed = "slow" | "normal" | "fast";
type PerformanceScore = "excellent" | "good" | "fair" | "poor";

type AnimationSpeeds = {
	slow: number;
	normal: number;
	fast: number;
};

type FpsThresholds = {
	excellent: number;
	good: number;
	fair: number;
	poor: number;
};

type LocalStorageKeys = {
	animationsEnabled: string;
	animationSpeed: string;
	reducedMotion: string;
};

type SpringConfig = {
	type?: "spring" | "tween" | "keyframes" | "inertia";
	duration?: number;
	damping?: number;
	mass?: number;
	stiffness?: number;
};

// biome-ignore lint/suspicious/noExplicitAny: Animation variants used with framer-motion
type AnimationVariants = Record<string, any>;

type PerformanceChangeData = {
	fps: number;
	score: PerformanceScore;
	drops: number;
	targetFps: number;
};

type AnimationProviderProps = {
	children: React.ReactNode;
	enablePerformanceMonitoring?: boolean;
	fpsTarget?: number;
	onPerformanceChange?: (data: PerformanceChangeData) => void;
};

type AnimationContextValue = {
	animationsEnabled: boolean;
	animationSpeed: AnimationSpeed;
	reducedMotion: boolean;
	systemReducedMotion: boolean;
	reducedMotionOverride: boolean | null;
	speedMultiplier: number;
	shouldAnimate: boolean;
	fps: number;
	performanceScore: PerformanceScore;
	frameDrops: number;
	fpsTarget: number;
	getDuration: (duration: number) => number;
	getSpring: (spring: SpringConfig) => SpringConfig;
	getVariants: (variants: AnimationVariants) => AnimationVariants;
	canAnimate: () => boolean;
	getGpuAcceleration: () => Record<string, string>;
	toggleAnimations: () => void;
	setSpeed: (speed: AnimationSpeed) => void;
	setReducedMotion: (value: boolean | null) => void;
	resetPreferences: () => void;
	setAnimationsEnabled: (enabled: boolean) => void;
};

// ========================================================================
// Context Creation
// ========================================================================

const AnimationContext = createContext<AnimationContextValue | null>(null);

// ========================================================================
// Constants
// ========================================================================

const ANIMATION_SPEEDS: AnimationSpeeds = {
	slow: 1.5,
	normal: 1,
	fast: 0.5,
};

const FPS_THRESHOLDS: FpsThresholds = {
	excellent: 55,
	good: 45,
	fair: 30,
	poor: 20,
};

const LOCAL_STORAGE_KEYS: LocalStorageKeys = {
	animationsEnabled: "tea-animations-enabled",
	animationSpeed: "tea-animation-speed",
	reducedMotion: "tea-reduced-motion",
};

// ========================================================================
// Animation Provider Component
// ========================================================================

export const AnimationProvider = ({
	children,
	enablePerformanceMonitoring = false,
	fpsTarget = 60,
	onPerformanceChange,
}: AnimationProviderProps) => {
	// ========================================================================
	// State Management
	// ========================================================================

	const [animationsEnabled, setAnimationsEnabled] = useState(() => {
		if (typeof window === "undefined") {
			return true;
		}
		const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.animationsEnabled);
		return stored !== null ? JSON.parse(stored) : true;
	});

	const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>(() => {
		if (typeof window === "undefined") {
			return "normal";
		}
		return (
			(localStorage.getItem(
				LOCAL_STORAGE_KEYS.animationSpeed
			) as AnimationSpeed) || "normal"
		);
	});

	const [reducedMotionOverride, setReducedMotionOverride] = useState<
		boolean | null
	>(() => {
		if (typeof window === "undefined") {
			return null;
		}
		const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.reducedMotion);
		return stored !== null ? JSON.parse(stored) : null;
	});

	const [systemReducedMotion, setSystemReducedMotion] = useState(() => {
		if (typeof window === "undefined") {
			return false;
		}
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	});

	const [fps, setFps] = useState(60);
	const [performanceScore, setPerformanceScore] =
		useState<PerformanceScore>("excellent");
	const [frameDrops, setFrameDrops] = useState(0);

	// ========================================================================
	// Derived State
	// ========================================================================

	const reducedMotion = useMemo(
		() =>
			reducedMotionOverride !== null
				? reducedMotionOverride
				: systemReducedMotion,
		[reducedMotionOverride, systemReducedMotion]
	);

	const speedMultiplier = useMemo(
		() => ANIMATION_SPEEDS[animationSpeed] || 1,
		[animationSpeed]
	);

	const shouldAnimate = useMemo(
		() => animationsEnabled && !reducedMotion,
		[animationsEnabled, reducedMotion]
	);

	// ========================================================================
	// Performance Monitoring
	// ========================================================================

	useEffect(() => {
		if (!enablePerformanceMonitoring || typeof window === "undefined") {
			return;
		}

		let frameCount = 0;
		let lastTime = performance.now();
		let lastFps = 60;
		let drops = 0;
		let animationFrameId: number;

		const calculateScore = (currentFps: number): PerformanceScore => {
			if (currentFps >= FPS_THRESHOLDS.excellent) {
				return "excellent";
			}
			if (currentFps >= FPS_THRESHOLDS.good) {
				return "good";
			}
			if (currentFps >= FPS_THRESHOLDS.fair) {
				return "fair";
			}
			return "poor";
		};

		const updatePerformanceMetrics = (currentFps: number) => {
			setFps(currentFps);
			const score = calculateScore(currentFps);
			setPerformanceScore(score);

			if (onPerformanceChange) {
				onPerformanceChange({
					fps: currentFps,
					score,
					drops,
					targetFps: fpsTarget,
				});
			}
		};

		const measureFps = (currentTime: number) => {
			frameCount++;
			const deltaTime = currentTime - lastTime;

			if (deltaTime >= 1000) {
				const currentFps = Math.round((frameCount * 1000) / deltaTime);

				if (currentFps < lastFps - 10) {
					drops++;
					setFrameDrops((prev) => prev + 1);
				}

				updatePerformanceMetrics(currentFps);
				lastFps = currentFps;
				frameCount = 0;
				lastTime = currentTime;
			}

			animationFrameId = requestAnimationFrame(measureFps);
		};

		animationFrameId = requestAnimationFrame(measureFps);

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	}, [enablePerformanceMonitoring, fpsTarget, onPerformanceChange]);

	// ========================================================================
	// System Preference Detection
	// ========================================================================

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

		const handleChange = (e: MediaQueryListEvent) => {
			setSystemReducedMotion(e.matches);
		};

		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
			return () => mediaQuery.removeEventListener("change", handleChange);
		}
		// Fallback for older browsers
		if (mediaQuery.addListener) {
			mediaQuery.addListener(handleChange);
			return () => mediaQuery.removeListener(handleChange);
		}
	}, []);

	// ========================================================================
	// Preference Persistence
	// ========================================================================

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		localStorage.setItem(
			LOCAL_STORAGE_KEYS.animationsEnabled,
			JSON.stringify(animationsEnabled)
		);
	}, [animationsEnabled]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		localStorage.setItem(LOCAL_STORAGE_KEYS.animationSpeed, animationSpeed);
	}, [animationSpeed]);

	useEffect(() => {
		if (typeof window === "undefined" || reducedMotionOverride === null) {
			return;
		}
		localStorage.setItem(
			LOCAL_STORAGE_KEYS.reducedMotion,
			JSON.stringify(reducedMotionOverride)
		);
	}, [reducedMotionOverride]);

	// ========================================================================
	// Animation Utilities
	// ========================================================================

	const getDuration = useCallback(
		(duration: number) => {
			if (!shouldAnimate) {
				return 1;
			}
			return duration / speedMultiplier;
		},
		[shouldAnimate, speedMultiplier]
	);

	const getSpring = useCallback(
		(spring: SpringConfig): SpringConfig => {
			if (!shouldAnimate) {
				return {
					type: "tween",
					duration: 0.01,
				};
			}

			return {
				...spring,
				damping: (spring.damping || 30) * speedMultiplier,
				mass: (spring.mass || 1) / speedMultiplier,
			};
		},
		[shouldAnimate, speedMultiplier]
	);

	const getVariants = useCallback(
		(variants: AnimationVariants): AnimationVariants => {
			if (!shouldAnimate) {
				return {
					initial: { opacity: 0 },
					animate: { opacity: 1 },
					exit: { opacity: 0 },
					transition: { duration: 0.01 },
				};
			}

			if (variants.transition) {
				const adjustedTransition = { ...variants.transition };

				if (adjustedTransition.duration) {
					adjustedTransition.duration /= speedMultiplier;
				}

				if (adjustedTransition.type === "spring") {
					adjustedTransition.damping =
						(adjustedTransition.damping || 30) * speedMultiplier;
					adjustedTransition.mass =
						(adjustedTransition.mass || 1) / speedMultiplier;
				}

				return {
					...variants,
					transition: adjustedTransition,
				};
			}

			return variants;
		},
		[shouldAnimate, speedMultiplier]
	);

	const canAnimate = useCallback(() => shouldAnimate, [shouldAnimate]);

	const getGpuAcceleration = useCallback(() => PERFORMANCE.gpuOnly, []);

	// ========================================================================
	// Control Methods
	// ========================================================================

	const toggleAnimations = useCallback(() => {
		setAnimationsEnabled((prev: boolean) => !prev);
	}, []);

	const setSpeed = useCallback((speed: AnimationSpeed) => {
		if (ANIMATION_SPEEDS[speed] !== undefined) {
			setAnimationSpeed(speed);
		}
	}, []);

	const setReducedMotion = useCallback((value: boolean | null) => {
		setReducedMotionOverride(value);
	}, []);

	const resetPreferences = useCallback(() => {
		setAnimationsEnabled(true);
		setAnimationSpeed("normal");
		setReducedMotionOverride(null);
		if (typeof window !== "undefined") {
			localStorage.removeItem(LOCAL_STORAGE_KEYS.animationsEnabled);
			localStorage.removeItem(LOCAL_STORAGE_KEYS.animationSpeed);
			localStorage.removeItem(LOCAL_STORAGE_KEYS.reducedMotion);
		}
	}, []);

	// ========================================================================
	// Context Value
	// ========================================================================

	const contextValue = useMemo(
		() => ({
			animationsEnabled,
			animationSpeed,
			reducedMotion,
			systemReducedMotion,
			reducedMotionOverride,
			speedMultiplier,
			shouldAnimate,
			fps,
			performanceScore,
			frameDrops,
			fpsTarget,
			getDuration,
			getSpring,
			getVariants,
			canAnimate,
			getGpuAcceleration,
			toggleAnimations,
			setSpeed,
			setReducedMotion,
			resetPreferences,
			setAnimationsEnabled,
		}),
		[
			animationsEnabled,
			animationSpeed,
			reducedMotion,
			systemReducedMotion,
			reducedMotionOverride,
			speedMultiplier,
			shouldAnimate,
			fps,
			performanceScore,
			frameDrops,
			fpsTarget,
			getDuration,
			getSpring,
			getVariants,
			canAnimate,
			getGpuAcceleration,
			toggleAnimations,
			setSpeed,
			setReducedMotion,
			resetPreferences,
		]
	);

	// ========================================================================
	// Render
	// ========================================================================

	return (
		<AnimationContext.Provider value={contextValue}>
			{children}
		</AnimationContext.Provider>
	);
};

// ========================================================================
// Hook
// ========================================================================

export const useAnimation = () => {
	const context = useContext(AnimationContext);

	if (!context) {
		throw new Error("useAnimation must be used within AnimationProvider");
	}

	return context;
};

// ========================================================================
// Performance Hook
// ========================================================================

export const useAnimationPerformance = () => {
	const { fps, performanceScore, frameDrops, fpsTarget } = useAnimation();

	return {
		fps,
		performanceScore,
		frameDrops,
		fpsTarget,
		isPerformant:
			performanceScore === "excellent" || performanceScore === "good",
		needsOptimization: performanceScore === "poor",
	};
};

// ========================================================================
// Preferences Hook
// ========================================================================

export const useAnimationPreferences = () => {
	const {
		animationsEnabled,
		animationSpeed,
		reducedMotion,
		systemReducedMotion,
		shouldAnimate,
		toggleAnimations,
		setSpeed,
		setReducedMotion,
		resetPreferences,
		setAnimationsEnabled,
	} = useAnimation();

	return {
		animationsEnabled,
		animationSpeed,
		reducedMotion,
		systemReducedMotion,
		shouldAnimate,
		toggleAnimations,
		setSpeed,
		setReducedMotion,
		resetPreferences,
		setAnimationsEnabled,
	};
};

// ========================================================================
// Export
// ========================================================================

export default AnimationProvider;
