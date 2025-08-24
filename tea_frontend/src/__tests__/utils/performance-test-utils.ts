/**
 * Performance testing utilities for the TEA Platform
 * These utilities help identify performance regressions and ensure the platform maintains good performance as it scales
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect } from "vitest";
import type {
	AssuranceCase,
	Evidence,
	Goal,
	PropertyClaim,
} from "../../../types/domain";

// Constants
const SEARCH_REGEX = /search/i;

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PerformanceMetrics {
	/** Time taken for component to render (milliseconds) */
	renderTime: number;
	/** Time taken for interaction to complete (milliseconds) */
	interactionTime?: number;
	/** Peak memory usage during test (bytes) */
	peakMemoryUsage: number;
	/** Memory usage after cleanup (bytes) */
	memoryAfterCleanup: number;
	/** Number of DOM nodes created */
	domNodeCount: number;
	/** Bundle size information */
	bundleSize?: BundleSizeMetrics;
	/** Custom timing measurements */
	customTimings: Record<string, number>;
}

export interface BundleSizeMetrics {
	/** Total bundle size in bytes */
	totalSize: number;
	/** JavaScript bundle size in bytes */
	jsSize: number;
	/** CSS bundle size in bytes */
	cssSize: number;
	/** Asset size in bytes */
	assetSize: number;
	/** Gzipped size in bytes */
	gzippedSize?: number;
}

export interface ApiPerformanceMetrics {
	/** Response time in milliseconds */
	responseTime: number;
	/** Request start timestamp */
	requestStart: number;
	/** Response end timestamp */
	responseEnd: number;
	/** Size of response payload in bytes */
	payloadSize: number;
	/** HTTP status code */
	statusCode: number;
	/** Whether request was cached */
	cached: boolean;
}

export interface CollaborationPerformanceMetrics {
	/** Time to establish WebSocket connection (milliseconds) */
	connectionTime: number;
	/** Message round-trip time (milliseconds) */
	messageRoundTripTime: number;
	/** Number of concurrent users simulated */
	concurrentUsers: number;
	/** Messages processed per second */
	messagesPerSecond: number;
	/** Memory usage with multiple connections */
	memoryWithConnections: number;
}

export interface LargeDatasetMetrics {
	/** Time to render large dataset (milliseconds) */
	renderTime: number;
	/** Number of items rendered */
	itemCount: number;
	/** Virtual scrolling efficiency */
	virtualScrollEfficiency?: number;
	/** Time for search/filter operations (milliseconds) */
	searchTime?: number;
	/** Memory usage for large dataset */
	memoryUsage: number;
}

export interface BenchmarkComparison {
	/** Current test results */
	current: PerformanceMetrics;
	/** Baseline/previous results for comparison */
	baseline?: PerformanceMetrics;
	/** Performance regression threshold (percentage) */
	regressionThreshold: number;
	/** Whether performance has regressed */
	hasRegression: boolean;
	/** Percentage change from baseline */
	percentageChange: number;
}

export interface PerformanceTestOptions {
	/** Number of iterations to run for averaging */
	iterations?: number;
	/** Warm-up runs before measurement */
	warmupRuns?: number;
	/** Maximum acceptable render time (milliseconds) */
	maxRenderTime?: number;
	/** Maximum acceptable interaction time (milliseconds) */
	maxInteractionTime?: number;
	/** Maximum acceptable memory usage (bytes) */
	maxMemoryUsage?: number;
	/** Whether to include garbage collection in measurements */
	includeGC?: boolean;
	/** Custom performance markers */
	customMarkers?: string[];
}

// ============================================================================
// Core Performance Measurement Utilities
// ============================================================================

/**
 * High-precision timer for measuring performance
 */
export class PerformanceTimer {
	private startTime = 0;
	private endTime = 0;
	private customMarkers: Map<string, number> = new Map();

	/**
	 * Start the timer
	 */
	start(): void {
		this.startTime = performance.now();
	}

	/**
	 * End the timer and return elapsed time
	 * @returns Elapsed time in milliseconds
	 */
	end(): number {
		this.endTime = performance.now();
		return this.getElapsedTime();
	}

	/**
	 * Add a custom timing marker
	 * @param name - Name of the marker
	 */
	mark(name: string): void {
		this.customMarkers.set(name, performance.now());
	}

	/**
	 * Get time elapsed since start
	 * @returns Elapsed time in milliseconds
	 */
	getElapsedTime(): number {
		return this.endTime - this.startTime;
	}

	/**
	 * Get time between two markers
	 * @param startMarker - Start marker name
	 * @param endMarker - End marker name
	 * @returns Time difference in milliseconds
	 */
	getMarkerDuration(startMarker: string, endMarker: string): number {
		const start = this.customMarkers.get(startMarker);
		const end = this.customMarkers.get(endMarker);

		if (start === undefined || end === undefined) {
			throw new Error(`Marker not found: ${startMarker} or ${endMarker}`);
		}

		return end - start;
	}

	/**
	 * Get all custom marker timings relative to start time
	 * @returns Map of marker names to their timing relative to start
	 */
	getCustomTimings(): Record<string, number> {
		const timings: Record<string, number> = {};

		this.customMarkers.forEach((time, name) => {
			timings[name] = time - this.startTime;
		});

		return timings;
	}

	/**
	 * Reset the timer
	 */
	reset(): void {
		this.startTime = 0;
		this.endTime = 0;
		this.customMarkers.clear();
	}
}

/**
 * Memory usage monitor for tracking memory consumption during tests
 */
export class MemoryMonitor {
	private initialMemory = 0;
	private peakMemory = 0;
	private measurements: number[] = [];
	private intervalId: NodeJS.Timeout | null = null;

	/**
	 * Start monitoring memory usage
	 * @param intervalMs - Measurement interval in milliseconds
	 */
	startMonitoring(intervalMs = 100): void {
		this.initialMemory = this.getCurrentMemoryUsage();
		this.peakMemory = this.initialMemory;
		this.measurements = [this.initialMemory];

		this.intervalId = setInterval(() => {
			const currentMemory = this.getCurrentMemoryUsage();
			this.measurements.push(currentMemory);

			if (currentMemory > this.peakMemory) {
				this.peakMemory = currentMemory;
			}
		}, intervalMs);
	}

	/**
	 * Stop monitoring and return metrics
	 * @returns Memory usage metrics
	 */
	stopMonitoring(): { peak: number; average: number; final: number } {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		const finalMemory = this.getCurrentMemoryUsage();
		const averageMemory =
			this.measurements.reduce((sum, mem) => sum + mem, 0) /
			this.measurements.length;

		return {
			peak: this.peakMemory,
			average: averageMemory,
			final: finalMemory,
		};
	}

	/**
	 * Get current memory usage (approximation for testing)
	 * @returns Estimated memory usage in bytes
	 */
	private getCurrentMemoryUsage(): number {
		// In a real browser environment, we could use performance.memory
		// For testing, we'll provide a mock implementation
		if (typeof performance !== "undefined" && "memory" in performance) {
			return (
				(performance as { memory?: { usedJSHeapSize?: number } }).memory
					?.usedJSHeapSize || 0
			);
		}

		// Mock memory usage for testing environment
		return Math.floor(Math.random() * 50_000_000) + 10_000_000; // 10-60MB range
	}

	/**
	 * Force garbage collection (if available)
	 */
	forceGC(): void {
		if (
			typeof global !== "undefined" &&
			"gc" in global &&
			typeof global.gc === "function"
		) {
			global.gc();
		}
	}
}

// ============================================================================
// Component Performance Testing
// ============================================================================

/**
 * Measure React component render performance
 * @param component - React component to test
 * @param options - Performance test options
 * @returns Performance metrics
 */
export async function measureComponentRenderPerformance(
	component: ReactElement,
	options: PerformanceTestOptions = {}
): Promise<PerformanceMetrics> {
	const {
		iterations = 1,
		warmupRuns = 0,
		includeGC = true,
		customMarkers = [],
	} = options;

	const timer = new PerformanceTimer();
	const memoryMonitor = new MemoryMonitor();
	const renderTimes: number[] = [];
	let domNodeCount = 0;

	// Warm-up runs
	for (let i = 0; i < warmupRuns; i++) {
		const { unmount } = render(component);
		unmount();
	}

	// Force GC before main measurements
	if (includeGC) {
		memoryMonitor.forceGC();
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	// Start memory monitoring
	memoryMonitor.startMonitoring(50);

	// Main measurement iterations
	for (let i = 0; i < iterations; i++) {
		timer.start();

		// Add custom markers if specified
		for (const marker of customMarkers) {
			timer.mark(`${marker}_start_${i}`);
		}

		const { container, unmount } = render(component);

		// Wait for any async rendering to complete
		// biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required for performance measurement
		await waitFor(() => {
			// Component should be in the document
			expect(container.firstChild).toBeTruthy();
		});

		timer.mark("render_complete");
		const renderTime = timer.end();
		renderTimes.push(renderTime);

		// Count DOM nodes
		domNodeCount = container.querySelectorAll("*").length;

		// Add final custom markers
		for (const marker of customMarkers) {
			timer.mark(`${marker}_end_${i}`);
		}

		unmount();

		// Small delay between iterations
		if (i < iterations - 1) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	const memoryMetrics = memoryMonitor.stopMonitoring();
	const averageRenderTime =
		renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;

	return {
		renderTime: averageRenderTime,
		peakMemoryUsage: memoryMetrics.peak,
		memoryAfterCleanup: memoryMetrics.final,
		domNodeCount,
		customTimings: timer.getCustomTimings(),
	};
}

/**
 * Measure interaction performance (clicks, form submissions, etc.)
 * @param component - React component to test
 * @param interaction - Function that performs the interaction
 * @param options - Performance test options
 * @returns Performance metrics including interaction time
 */
export async function measureInteractionPerformance(
	component: ReactElement,
	interaction: (container: HTMLElement) => Promise<void> | void,
	options: PerformanceTestOptions = {}
): Promise<PerformanceMetrics> {
	const { iterations = 1, warmupRuns = 0, includeGC = true } = options;

	const timer = new PerformanceTimer();
	const memoryMonitor = new MemoryMonitor();
	const interactionTimes: number[] = [];
	const renderTimes: number[] = [];

	// Warm-up runs
	for (let i = 0; i < warmupRuns; i++) {
		const { container, unmount } = render(component);
		// biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required for performance measurement
		await interaction(container);
		unmount();
	}

	if (includeGC) {
		memoryMonitor.forceGC();
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	memoryMonitor.startMonitoring(25);

	for (let i = 0; i < iterations; i++) {
		// Measure render time
		timer.start();
		const { container, unmount } = render(component);
		// biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required for performance measurement
		await waitFor(() => {
			expect(container.firstChild).toBeTruthy();
		});
		const renderTime = timer.end();
		renderTimes.push(renderTime);

		// Measure interaction time
		timer.start();
		timer.mark("interaction_start");

		await interaction(container);

		timer.mark("interaction_end");
		const interactionTime = timer.end();
		interactionTimes.push(interactionTime);

		unmount();

		if (i < iterations - 1) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	const memoryMetrics = memoryMonitor.stopMonitoring();
	const averageRenderTime =
		renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
	const averageInteractionTime =
		interactionTimes.reduce((sum, time) => sum + time, 0) /
		interactionTimes.length;

	return {
		renderTime: averageRenderTime,
		interactionTime: averageInteractionTime,
		peakMemoryUsage: memoryMetrics.peak,
		memoryAfterCleanup: memoryMetrics.final,
		domNodeCount: 0, // Not measured in interaction tests
		customTimings: timer.getCustomTimings(),
	};
}

// ============================================================================
// Bundle Size Testing Utilities
// ============================================================================

/**
 * Mock bundle size analyzer for testing environments
 * In a real implementation, this would integrate with webpack-bundle-analyzer or similar
 */
export class BundleSizeAnalyzer {
	private mockBundles: Map<string, BundleSizeMetrics> = new Map();

	/**
	 * Set mock bundle size data for testing
	 * @param bundleName - Name of the bundle
	 * @param metrics - Bundle size metrics
	 */
	setMockBundleSize(bundleName: string, metrics: BundleSizeMetrics): void {
		this.mockBundles.set(bundleName, metrics);
	}

	/**
	 * Analyze bundle size for a given component or module
	 * @param bundleName - Name of the bundle to analyze
	 * @returns Bundle size metrics
	 */
	analyzeBundleSize(bundleName: string): BundleSizeMetrics {
		const mockData = this.mockBundles.get(bundleName);
		if (mockData) {
			return mockData;
		}

		// Return default mock data
		return {
			totalSize: 245_760, // ~240KB
			jsSize: 204_800, // ~200KB
			cssSize: 20_480, // ~20KB
			assetSize: 20_480, // ~20KB
			gzippedSize: 81_920, // ~80KB (gzipped)
		};
	}

	/**
	 * Check if bundle size exceeds acceptable limits
	 * @param bundleName - Name of the bundle
	 * @param limits - Size limits to check against
	 * @returns Whether bundle exceeds limits
	 */
	checkBundleSizeLimits(
		bundleName: string,
		limits: {
			maxTotalSize?: number;
			maxJsSize?: number;
			maxCssSize?: number;
			maxGzippedSize?: number;
		}
	): { exceeds: boolean; violations: string[] } {
		const metrics = this.analyzeBundleSize(bundleName);
		const violations: string[] = [];

		if (limits.maxTotalSize && metrics.totalSize > limits.maxTotalSize) {
			violations.push(
				`Total size ${metrics.totalSize} exceeds limit ${limits.maxTotalSize}`
			);
		}

		if (limits.maxJsSize && metrics.jsSize > limits.maxJsSize) {
			violations.push(
				`JS size ${metrics.jsSize} exceeds limit ${limits.maxJsSize}`
			);
		}

		if (limits.maxCssSize && metrics.cssSize > limits.maxCssSize) {
			violations.push(
				`CSS size ${metrics.cssSize} exceeds limit ${limits.maxCssSize}`
			);
		}

		if (
			limits.maxGzippedSize &&
			metrics.gzippedSize &&
			metrics.gzippedSize > limits.maxGzippedSize
		) {
			violations.push(
				`Gzipped size ${metrics.gzippedSize} exceeds limit ${limits.maxGzippedSize}`
			);
		}

		return {
			exceeds: violations.length > 0,
			violations,
		};
	}
}

// ============================================================================
// API Performance Testing
// ============================================================================

/**
 * Measure API response time and performance
 * @param apiCall - Function that makes the API call
 * @param iterations - Number of iterations to average
 * @returns API performance metrics
 */
export async function measureApiPerformance(
	apiCall: () => Promise<Response>,
	iterations = 1
): Promise<ApiPerformanceMetrics> {
	const responseTimes: number[] = [];
	let totalPayloadSize = 0;
	let statusCode = 200;
	let cached = false;

	for (let i = 0; i < iterations; i++) {
		const startTime = performance.now();

		try {
			// biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required for performance measurement
			const response = await apiCall();
			const endTime = performance.now();

			const responseTime = endTime - startTime;
			responseTimes.push(responseTime);

			statusCode = response.status;
			cached = response.headers.get("cache-control") !== null;

			// Estimate payload size
			const contentLength = response.headers.get("content-length");
			if (contentLength) {
				totalPayloadSize += Number.parseInt(contentLength, 10);
			} else {
				// Fallback: read response body to get size
				const responseText = await response.text();
				totalPayloadSize += new Blob([responseText]).size;
			}
		} catch (_error) {
			const endTime = performance.now();
			responseTimes.push(endTime - startTime);
			statusCode = 500; // Error status
		}
	}

	const averageResponseTime =
		responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
	const averagePayloadSize = totalPayloadSize / iterations;

	return {
		responseTime: averageResponseTime,
		requestStart: performance.now(), // Approximation
		responseEnd: performance.now(), // Approximation
		payloadSize: averagePayloadSize,
		statusCode,
		cached,
	};
}

/**
 * Create a mock API call for testing
 * @param responseData - Mock response data
 * @param delay - Simulated network delay in milliseconds
 * @returns Mock API call function
 */
export function createMockApiCall(
	responseData: unknown,
	delay = 100
): () => Promise<Response> {
	return async () => {
		await new Promise((resolve) => setTimeout(resolve, delay));

		const response = new Response(JSON.stringify(responseData), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Content-Length": new Blob([
					JSON.stringify(responseData),
				]).size.toString(),
			},
		});

		return response;
	};
}

// ============================================================================
// Real-time Collaboration Performance Testing
// ============================================================================

/**
 * Mock WebSocket for testing collaboration features
 */
export class MockWebSocket {
	private messageHandlers: ((event: MessageEvent) => void)[] = [];
	private connectionTime = 0;
	private messagesSent = 0;
	private messagesReceived = 0;
	readyState: number = WebSocket.CONNECTING;

	constructor() {
		// Simulate connection time
		setTimeout(
			() => {
				this.readyState = WebSocket.OPEN;
				this.connectionTime = performance.now();
				this.dispatchEvent(new Event("open"));
			},
			Math.random() * 100 + 50
		); // 50-150ms connection time
	}

	addEventListener(type: string, listener: (event: Event) => void): void {
		if (type === "message") {
			this.messageHandlers.push(listener as (event: MessageEvent) => void);
		}
	}

	removeEventListener(type: string, listener: (event: Event) => void): void {
		if (type === "message") {
			const index = this.messageHandlers.indexOf(
				listener as (event: MessageEvent) => void
			);
			if (index > -1) {
				this.messageHandlers.splice(index, 1);
			}
		}
	}

	send(data: string): void {
		this.messagesSent++;

		// Simulate round-trip time
		setTimeout(
			() => {
				const response = this.generateMockResponse(data);
				const event = new MessageEvent("message", { data: response });
				for (const handler of this.messageHandlers) {
					handler(event);
				}
				this.messagesReceived++;
			},
			Math.random() * 50 + 10
		); // 10-60ms round-trip
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
		this.dispatchEvent(new Event("close"));
	}

	private generateMockResponse(data: string): string {
		// Generate appropriate mock response based on message type
		try {
			const parsed = JSON.parse(data);
			return JSON.stringify({
				type: "response",
				id: parsed.id || Date.now(),
				success: true,
				data: { acknowledged: true },
			});
		} catch {
			return JSON.stringify({
				type: "error",
				message: "Invalid message format",
			});
		}
	}

	private dispatchEvent(_event: Event): void {
		// Mock event dispatching
	}

	getStats(): {
		connectionTime: number;
		messagesSent: number;
		messagesReceived: number;
	} {
		return {
			connectionTime: this.connectionTime,
			messagesSent: this.messagesSent,
			messagesReceived: this.messagesReceived,
		};
	}
}

/**
 * Measure real-time collaboration performance
 * @param concurrentUsers - Number of concurrent users to simulate
 * @param messageCount - Number of messages to send per user
 * @returns Collaboration performance metrics
 */
export async function measureCollaborationPerformance(
	concurrentUsers = 5,
	messageCount = 10
): Promise<CollaborationPerformanceMetrics> {
	const connections: MockWebSocket[] = [];
	const connectionTimes: number[] = [];
	const roundTripTimes: number[] = [];
	const memoryMonitor = new MemoryMonitor();

	memoryMonitor.startMonitoring(100);

	// Create concurrent connections
	const connectionPromises = Array.from({ length: concurrentUsers }, () => {
		return new Promise<MockWebSocket>((resolve) => {
			const ws = new MockWebSocket();
			connections.push(ws);

			ws.addEventListener("open", () => {
				const stats = ws.getStats();
				connectionTimes.push(stats.connectionTime);
				resolve(ws);
			});
		});
	});

	await Promise.all(connectionPromises);

	// Send messages and measure round-trip times
	const messagePromises = connections.map((ws) => {
		const promises: Promise<void>[] = [];
		for (let i = 0; i < messageCount; i++) {
			const messageStart = performance.now();

			const promise = new Promise<void>((resolve) => {
				ws.addEventListener("message", () => {
					const messageEnd = performance.now();
					roundTripTimes.push(messageEnd - messageStart);
					resolve();
				});

				ws.send(
					JSON.stringify({
						type: "update",
						id: Date.now() + i,
						data: {
							action: "edit",
							element: "goal",
							content: `Test content ${i}`,
						},
					})
				);
			});
			promises.push(promise);
		}
		return Promise.all(promises);
	});

	await Promise.all(messagePromises);

	// Calculate metrics
	const averageConnectionTime =
		connectionTimes.reduce((sum, time) => sum + time, 0) /
		connectionTimes.length;
	const averageRoundTripTime =
		roundTripTimes.reduce((sum, time) => sum + time, 0) / roundTripTimes.length;
	const totalMessages = concurrentUsers * messageCount;
	const testDuration = Math.max(...roundTripTimes) + averageConnectionTime;
	const messagesPerSecond = totalMessages / (testDuration / 1000);

	const memoryMetrics = memoryMonitor.stopMonitoring();

	// Clean up connections
	for (const ws of connections) {
		ws.close();
	}

	return {
		connectionTime: averageConnectionTime,
		messageRoundTripTime: averageRoundTripTime,
		concurrentUsers,
		messagesPerSecond,
		memoryWithConnections: memoryMetrics.peak,
	};
}

// ============================================================================
// Large Dataset Performance Testing
// ============================================================================

/**
 * Generate large dataset for performance testing
 * @param itemCount - Number of items to generate
 * @param dataType - Type of data to generate
 * @returns Generated dataset
 */
export function generateLargeDataset(
	itemCount: number,
	dataType: "assuranceCases" | "goals" | "propertyClaims" | "evidence"
): unknown[] {
	const dataset: unknown[] = [];

	for (let i = 0; i < itemCount; i++) {
		switch (dataType) {
			case "assuranceCases":
				dataset.push({
					id: i + 1,
					name: `Large Dataset Assurance Case ${i + 1}`,
					description: `Performance test case ${i + 1} with detailed description and multiple elements`,
					created_date: new Date(
						Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
					).toISOString(),
					owner: Math.floor(Math.random() * 100) + 1,
					goals: Array.from(
						{ length: Math.floor(Math.random() * 5) + 1 },
						(_, gi) => ({
							id: i * 100 + gi,
							name: `Goal ${gi + 1} for Case ${i + 1}`,
						})
					),
				} as Partial<AssuranceCase>);
				break;

			case "goals":
				dataset.push({
					id: i + 1,
					name: `Performance Test Goal ${i + 1}`,
					short_description: `Short description for goal ${i + 1}`,
					long_description: `Detailed long description for performance testing goal ${i + 1} with lots of text content`,
					assurance_case_id: Math.floor(i / 10) + 1,
				} as Partial<Goal>);
				break;

			case "propertyClaims":
				dataset.push({
					id: i + 1,
					name: `Property Claim ${i + 1}`,
					short_description: `Claim ${i + 1} for performance testing`,
					long_description: `Comprehensive property claim ${i + 1} with detailed argumentation`,
					level: Math.floor(Math.random() * 3) + 1,
					claim_type: Math.random() > 0.5 ? "claim" : "assumption",
				} as Partial<PropertyClaim>);
				break;

			case "evidence":
				dataset.push({
					id: i + 1,
					name: `Evidence Item ${i + 1}`,
					short_description: `Evidence ${i + 1} description`,
					long_description: `Detailed evidence ${i + 1} supporting various claims`,
					URL: `https://example.com/evidence/${i + 1}`,
					property_claim_id: [Math.floor(Math.random() * 100) + 1],
				} as Partial<Evidence>);
				break;
			default:
				// Unknown data type, skip
				break;
		}
	}

	return dataset;
}

/**
 * Measure performance with large datasets
 * @param component - Component to test with large dataset
 * @param dataset - Large dataset to use
 * @param options - Test options
 * @returns Large dataset performance metrics
 */
export async function measureLargeDatasetPerformance(
	component: ReactElement,
	dataset: unknown[],
	options: {
		searchTerm?: string;
		filterFunction?: (item: unknown) => boolean;
		measureVirtualScrolling?: boolean;
	} = {}
): Promise<LargeDatasetMetrics> {
	const timer = new PerformanceTimer();
	const memoryMonitor = new MemoryMonitor();

	memoryMonitor.startMonitoring(100);

	// Measure initial render with large dataset
	timer.start();
	const { container, unmount } = render(component);

	await waitFor(() => {
		expect(container.firstChild).toBeTruthy();
	});

	const renderTime = timer.end();

	// Measure search performance if search term provided
	let searchTime: number | undefined;
	if (options.searchTerm) {
		timer.start();

		// Simulate search operation
		const searchInput = screen.queryByRole("textbox", { name: SEARCH_REGEX });
		if (searchInput) {
			fireEvent.change(searchInput, { target: { value: options.searchTerm } });

			await waitFor(
				() => {
					// Wait for search results to be displayed
					const results = container.querySelectorAll(
						'[data-testid*="search-result"]'
					);
					expect(results.length).toBeGreaterThan(0);
				},
				{ timeout: 5000 }
			);
		}

		searchTime = timer.end();
	}

	// Measure virtual scrolling efficiency if enabled
	let virtualScrollEfficiency: number | undefined;
	if (options.measureVirtualScrolling) {
		const renderedItems = container.querySelectorAll(
			'[data-testid*="list-item"]'
		);
		virtualScrollEfficiency = (renderedItems.length / dataset.length) * 100;
	}

	const memoryMetrics = memoryMonitor.stopMonitoring();
	unmount();

	return {
		renderTime,
		itemCount: dataset.length,
		virtualScrollEfficiency,
		searchTime,
		memoryUsage: memoryMetrics.peak,
	};
}

// ============================================================================
// Benchmark Comparison Utilities
// ============================================================================

/**
 * Storage for performance baselines
 */
class PerformanceBaseline {
	private baselines: Map<string, PerformanceMetrics> = new Map();

	/**
	 * Set baseline metrics for a test
	 * @param testName - Name of the test
	 * @param metrics - Baseline performance metrics
	 */
	setBaseline(testName: string, metrics: PerformanceMetrics): void {
		this.baselines.set(testName, { ...metrics });
	}

	/**
	 * Get baseline metrics for a test
	 * @param testName - Name of the test
	 * @returns Baseline metrics or undefined if not set
	 */
	getBaseline(testName: string): PerformanceMetrics | undefined {
		return this.baselines.get(testName);
	}

	/**
	 * Clear all baselines
	 */
	clearBaselines(): void {
		this.baselines.clear();
	}

	/**
	 * Export baselines to JSON string
	 * @returns JSON representation of baselines
	 */
	exportBaselines(): string {
		const baselineData: Record<string, PerformanceMetrics> = {};
		this.baselines.forEach((value, key) => {
			baselineData[key] = value;
		});
		return JSON.stringify(baselineData, null, 2);
	}

	/**
	 * Import baselines from JSON string
	 * @param jsonData - JSON representation of baselines
	 */
	importBaselines(jsonData: string): void {
		try {
			const baselineData = JSON.parse(jsonData);
			for (const [key, value] of Object.entries(baselineData)) {
				this.baselines.set(key, value as PerformanceMetrics);
			}
		} catch (error) {
			throw new Error(`Failed to import baselines: ${error}`);
		}
	}
}

// Global baseline storage
const globalBaseline = new PerformanceBaseline();

/**
 * Compare current performance against baseline
 * @param testName - Name of the test
 * @param currentMetrics - Current performance metrics
 * @param regressionThreshold - Threshold for regression detection (percentage)
 * @returns Benchmark comparison results
 */
export function compareBenchmark(
	testName: string,
	currentMetrics: PerformanceMetrics,
	regressionThreshold = 10
): BenchmarkComparison {
	const baseline = globalBaseline.getBaseline(testName);

	if (!baseline) {
		// No baseline available, set current as baseline
		globalBaseline.setBaseline(testName, currentMetrics);

		return {
			current: currentMetrics,
			baseline: undefined,
			regressionThreshold,
			hasRegression: false,
			percentageChange: 0,
		};
	}

	// Calculate performance change
	const renderTimeChange =
		((currentMetrics.renderTime - baseline.renderTime) / baseline.renderTime) *
		100;
	const memoryChange =
		((currentMetrics.peakMemoryUsage - baseline.peakMemoryUsage) /
			baseline.peakMemoryUsage) *
		100;

	// Consider interaction time if available
	let interactionTimeChange = 0;
	if (currentMetrics.interactionTime && baseline.interactionTime) {
		interactionTimeChange =
			((currentMetrics.interactionTime - baseline.interactionTime) /
				baseline.interactionTime) *
			100;
	}

	// Overall performance change (weighted average)
	const overallChange =
		(renderTimeChange + memoryChange + interactionTimeChange) / 3;
	const hasRegression = overallChange > regressionThreshold;

	return {
		current: currentMetrics,
		baseline,
		regressionThreshold,
		hasRegression,
		percentageChange: overallChange,
	};
}

/**
 * Set performance baseline for a test
 * @param testName - Name of the test
 * @param metrics - Baseline performance metrics
 */
export function setPerformanceBaseline(
	testName: string,
	metrics: PerformanceMetrics
): void {
	globalBaseline.setBaseline(testName, metrics);
}

/**
 * Export all performance baselines
 * @returns JSON string of all baselines
 */
export function exportPerformanceBaselines(): string {
	return globalBaseline.exportBaselines();
}

/**
 * Import performance baselines from JSON
 * @param jsonData - JSON string of baselines
 */
export function importPerformanceBaselines(jsonData: string): void {
	globalBaseline.importBaselines(jsonData);
}

/**
 * Clear all performance baselines
 */
export function clearPerformanceBaselines(): void {
	globalBaseline.clearBaselines();
}

// ============================================================================
// Test Assertion Utilities
// ============================================================================

/**
 * Assert that performance metrics meet specified criteria
 * @param metrics - Performance metrics to validate
 * @param criteria - Performance criteria to check
 */
export function assertPerformanceCriteria(
	metrics: PerformanceMetrics,
	criteria: {
		maxRenderTime?: number;
		maxInteractionTime?: number;
		maxMemoryUsage?: number;
		maxDomNodes?: number;
	}
): void {
	if (criteria.maxRenderTime && metrics.renderTime > criteria.maxRenderTime) {
		throw new Error(
			`Render time ${metrics.renderTime}ms exceeds maximum ${criteria.maxRenderTime}ms`
		);
	}

	if (
		criteria.maxInteractionTime &&
		metrics.interactionTime &&
		metrics.interactionTime > criteria.maxInteractionTime
	) {
		throw new Error(
			`Interaction time ${metrics.interactionTime}ms exceeds maximum ${criteria.maxInteractionTime}ms`
		);
	}

	if (
		criteria.maxMemoryUsage &&
		metrics.peakMemoryUsage > criteria.maxMemoryUsage
	) {
		throw new Error(
			`Memory usage ${metrics.peakMemoryUsage} bytes exceeds maximum ${criteria.maxMemoryUsage} bytes`
		);
	}

	if (criteria.maxDomNodes && metrics.domNodeCount > criteria.maxDomNodes) {
		throw new Error(
			`DOM node count ${metrics.domNodeCount} exceeds maximum ${criteria.maxDomNodes}`
		);
	}
}

/**
 * Assert that no performance regression occurred
 * @param comparison - Benchmark comparison result
 */
export function assertNoPerformanceRegression(
	comparison: BenchmarkComparison
): void {
	if (comparison.hasRegression) {
		const message = `Performance regression detected: ${comparison.percentageChange.toFixed(2)}% degradation exceeds threshold of ${comparison.regressionThreshold}%`;
		throw new Error(message);
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format performance metrics for display
 * @param metrics - Performance metrics to format
 * @returns Formatted string representation
 */
export function formatPerformanceMetrics(metrics: PerformanceMetrics): string {
	const lines = [
		`Render Time: ${metrics.renderTime.toFixed(2)}ms`,
		`Peak Memory: ${(metrics.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
		`Memory After Cleanup: ${(metrics.memoryAfterCleanup / 1024 / 1024).toFixed(2)}MB`,
		`DOM Nodes: ${metrics.domNodeCount}`,
	];

	if (metrics.interactionTime) {
		lines.splice(
			1,
			0,
			`Interaction Time: ${metrics.interactionTime.toFixed(2)}ms`
		);
	}

	if (Object.keys(metrics.customTimings).length > 0) {
		lines.push("Custom Timings:");
		for (const [name, time] of Object.entries(metrics.customTimings)) {
			lines.push(`  ${name}: ${time.toFixed(2)}ms`);
		}
	}

	return lines.join("\n");
}

/**
 * Generate performance test report
 * @param testResults - Map of test names to their results
 * @returns Formatted performance report
 */
export function generatePerformanceReport(
	testResults: Map<string, BenchmarkComparison>
): string {
	const lines = ["# Performance Test Report", ""];

	testResults.forEach((comparison, testName) => {
		lines.push(`## ${testName}`);
		lines.push("");
		lines.push("### Current Metrics");
		lines.push(formatPerformanceMetrics(comparison.current));
		lines.push("");

		if (comparison.baseline) {
			lines.push("### Baseline Metrics");
			lines.push(formatPerformanceMetrics(comparison.baseline));
			lines.push("");

			const status = comparison.hasRegression ? "❌ REGRESSION" : "✅ PASSED";
			const change = comparison.percentageChange >= 0 ? "+" : "";
			lines.push(`### Result: ${status}`);
			lines.push(
				`Performance change: ${change}${comparison.percentageChange.toFixed(2)}%`
			);
			lines.push(`Regression threshold: ${comparison.regressionThreshold}%`);
		} else {
			lines.push("### Result: ! NO BASELINE");
			lines.push("Baseline has been set for future comparisons.");
		}

		lines.push("");
		lines.push("---");
		lines.push("");
	});

	return lines.join("\n");
}
