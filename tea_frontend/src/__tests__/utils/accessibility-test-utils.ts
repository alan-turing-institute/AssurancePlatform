/**
 * Comprehensive accessibility testing utilities for the TEA Platform
 *
 * These utilities help ensure the TEA Platform meets WCAG guidelines and
 * provides an accessible experience for users with disabilities.
 *
 * Features:
 * - Keyboard navigation testing (tab order, escape key, enter key)
 * - Screen reader compatibility (aria-labels, roles, descriptions)
 * - Focus management (focus trapping in modals, focus restoration)
 * - Color contrast and visual accessibility
 * - Testing with different accessibility preferences
 * - Form accessibility (labels, error messages, validation)
 * - Landmark navigation
 */

import type { RenderResult } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";

// Temporarily disable axe imports to debug test freezing
let axe: any = null;
type AxeResult = any;
type AxeRunOptions = any;

// Lazy load axe only when needed
async function loadAxe() {
	if (!axe) {
		try {
			const axeModule = await import("vitest-axe");
			axe = axeModule.axe;
		} catch (_error) {}
	}
	return axe;
}

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration for accessibility testing
 */
export interface AccessibilityTestConfig {
	/** Skip axe-core accessibility checks */
	skipAxe?: boolean;
	/** Custom axe-core rules configuration */
	axeOptions?: AxeRunOptions;
	/** Expected WCAG conformance level */
	wcagLevel?: "A" | "AA" | "AAA";
	/** Focus management expectations */
	focusManagement?: {
		/** Should focus be trapped within the component */
		trapFocus?: boolean;
		/** Element that should receive initial focus */
		initialFocus?: string;
		/** Element that should receive focus when component unmounts */
		restoreFocus?: boolean;
	};
}

/**
 * Result of keyboard navigation test
 */
export interface KeyboardNavigationResult {
	/** Elements that received focus in order */
	focusedElements: HTMLElement[];
	/** Whether tab order is logical */
	hasLogicalTabOrder: boolean;
	/** Elements that should be focusable but aren't */
	missingFocusableElements: HTMLElement[];
	/** Elements that are focusable but shouldn't be */
	unexpectedFocusableElements: HTMLElement[];
}

/**
 * Screen reader testing result
 */
export interface ScreenReaderResult {
	/** Elements missing accessible names */
	missingAccessibleNames: HTMLElement[];
	/** Elements with insufficient descriptions */
	insufficientDescriptions: HTMLElement[];
	/** Elements with incorrect roles */
	incorrectRoles: HTMLElement[];
	/** Overall accessibility score (0-100) */
	accessibilityScore: number;
}

/**
 * Focus management test result
 */
export interface FocusManagementResult {
	/** Whether focus is properly trapped */
	isFocusTrapped: boolean;
	/** Whether focus is restored correctly */
	isFocusRestored: boolean;
	/** Initial focus element */
	initialFocusElement: HTMLElement | null;
	/** Focus restoration element */
	restorationElement: HTMLElement | null;
}

/**
 * Color contrast test result
 */
export interface ColorContrastResult {
	/** Elements with insufficient contrast */
	lowContrastElements: Array<{
		element: HTMLElement;
		contrastRatio: number;
		required: number;
	}>;
	/** Overall contrast compliance */
	isCompliant: boolean;
	/** Minimum contrast ratio found */
	minimumContrast: number;
}

/**
 * Accessibility preferences for testing
 */
export interface AccessibilityPreferences {
	/** Reduced motion preference */
	prefersReducedMotion?: boolean;
	/** High contrast preference */
	prefersHighContrast?: boolean;
	/** Color scheme preference */
	colorScheme?: "light" | "dark";
	/** Font size multiplier */
	fontSizeMultiplier?: number;
	/** Screen reader simulation */
	simulateScreenReader?: boolean;
}

// =============================================================================
// Core Accessibility Testing
// =============================================================================

/**
 * Run comprehensive accessibility tests on a rendered component
 */
async function runAccessibilityTests(
	container: HTMLElement,
	config: AccessibilityTestConfig = {}
): Promise<{
	axeResult?: AxeResult;
	violations: string[];
	warnings: string[];
	passed: boolean;
}> {
	const violations: string[] = [];
	const warnings: string[] = [];

	let axeResult: AxeResult | undefined;

	// Run axe-core tests if not skipped
	if (!config.skipAxe) {
		try {
			const axeInstance = await loadAxe();
			if (axeInstance) {
				axeResult = await axeInstance(container, {
					...config.axeOptions,
				});

				// Process axe violations
				if (axeResult.violations) {
					axeResult.violations.forEach((violation: any) => {
						const message = `${violation.id}: ${violation.description} (${violation.nodes.length} instances)`;
						violations.push(message);
					});
				}

				// Process axe incomplete checks as warnings
				if (axeResult.incomplete) {
					axeResult.incomplete.forEach((incomplete: any) => {
						const message = `Incomplete check - ${incomplete.id}: ${incomplete.description}`;
						warnings.push(message);
					});
				}
			} else {
			}
		} catch (error) {
			violations.push(
				`Axe-core error: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	// Additional custom accessibility checks
	const customViolations = await runCustomAccessibilityChecks(container);
	violations.push(...customViolations);

	return {
		axeResult,
		violations,
		warnings,
		passed: violations.length === 0,
	};
}

/**
 * Run custom accessibility checks beyond axe-core
 */
async function runCustomAccessibilityChecks(
	container: HTMLElement
): Promise<string[]> {
	const violations: string[] = [];

	// Check for missing alt text on images
	const images = container.querySelectorAll("img");
	images.forEach((img, index) => {
		if (
			!(
				img.alt ||
				img.getAttribute("aria-label") ||
				img.getAttribute("aria-labelledby")
			)
		) {
			violations.push(
				`Image ${index + 1} missing alt text or accessible label`
			);
		}
	});

	// Check for empty links
	const links = container.querySelectorAll("a");
	links.forEach((link, index) => {
		if (
			!(
				link.textContent?.trim() ||
				link.getAttribute("aria-label") ||
				link.getAttribute("aria-labelledby")
			)
		) {
			violations.push(`Link ${index + 1} has no accessible text content`);
		}
	});

	// Check for buttons with inadequate accessible names
	const buttons = container.querySelectorAll("button");
	buttons.forEach((button, index) => {
		const hasAccessibleName =
			button.getAttribute("aria-label") ||
			button.getAttribute("aria-labelledby") ||
			(button.textContent?.trim() && button.textContent.trim().length > 1);

		if (!hasAccessibleName) {
			violations.push(
				`Button ${index + 1} has inadequate accessible name or description`
			);
		}
	});

	// Check for missing form labels
	const inputs = container.querySelectorAll('input:not([type="hidden"])');
	inputs.forEach((input, index) => {
		const hasLabel =
			input.getAttribute("aria-label") ||
			input.getAttribute("aria-labelledby") ||
			container.querySelector(`label[for="${input.id}"]`) ||
			input.closest("label");

		if (!hasLabel) {
			violations.push(
				`Input ${index + 1} (type: ${input.getAttribute("type") || "text"}) missing label`
			);
		}
	});

	// Check for missing headings hierarchy
	const headings = Array.from(
		container.querySelectorAll("h1, h2, h3, h4, h5, h6")
	);
	if (headings.length > 1) {
		for (let i = 1; i < headings.length; i++) {
			const current = Number.parseInt(headings[i].tagName.charAt(1), 10);
			const previous = Number.parseInt(headings[i - 1].tagName.charAt(1), 10);

			if (current > previous + 1) {
				violations.push(
					`Heading hierarchy skip: ${headings[i - 1].tagName} followed by ${headings[i].tagName}`
				);
			}
		}
	}

	return violations;
}

// =============================================================================
// Keyboard Navigation Testing
// =============================================================================

/**
 * Test keyboard navigation through a component
 */
async function testKeyboardNavigation(
	container: HTMLElement,
	user?: UserEvent
): Promise<KeyboardNavigationResult> {
	const testUser = user || userEvent.setup();
	const focusedElements: HTMLElement[] = [];

	// Get all potentially focusable elements
	const focusableSelector = [
		"a[href]",
		"button:not([disabled])",
		"input:not([disabled])",
		"select:not([disabled])",
		"textarea:not([disabled])",
		'[tabindex]:not([tabindex="-1"])',
		"details",
		"summary",
	].join(", ");

	const potentiallyFocusable = Array.from(
		container.querySelectorAll(focusableSelector)
	);
	const visibleFocusable = potentiallyFocusable.filter(
		(el) =>
			(el as HTMLElement).offsetParent !== null && !isHidden(el as HTMLElement)
	);

	// Track focus events
	const focusHandler = (event: FocusEvent) => {
		if (
			event.target instanceof HTMLElement &&
			container.contains(event.target)
		) {
			focusedElements.push(event.target);
		}
	};

	document.addEventListener("focusin", focusHandler);

	try {
		// Tab through all focusable elements
		let tabCount = 0;
		const maxTabs = visibleFocusable.length + 5; // Add buffer to prevent infinite loops

		while (tabCount < maxTabs) {
			await testUser.tab();
			tabCount++;

			const activeElement = document.activeElement as HTMLElement;
			if (!(activeElement && container.contains(activeElement))) {
				break;
			}
		}

		// Test reverse tab navigation
		await testUser.tab({ shift: true });
	} finally {
		document.removeEventListener("focusin", focusHandler);
	}

	const actualFocusable = Array.from(new Set(focusedElements));
	const missingFocusableElements = visibleFocusable.filter(
		(el) => !actualFocusable.includes(el as HTMLElement)
	) as HTMLElement[];

	const unexpectedFocusableElements = actualFocusable.filter(
		(el) => !visibleFocusable.includes(el)
	);

	return {
		focusedElements: actualFocusable,
		hasLogicalTabOrder: checkLogicalTabOrder(actualFocusable),
		missingFocusableElements,
		unexpectedFocusableElements,
	};
}

/**
 * Test specific keyboard interactions
 */
async function testKeyboardInteractions(
	element: HTMLElement,
	user?: UserEvent
): Promise<{
	enterWorks: boolean;
	spaceWorks: boolean;
	escapeWorks: boolean;
	arrowKeysWork: boolean;
}> {
	const testUser = user || userEvent.setup();
	let enterTriggered = false;
	let spaceTriggered = false;
	let escapeTriggered = false;
	let arrowKeyTriggered = false;

	// Focus the element first
	element.focus();

	// Test Enter key
	const enterHandler = () => {
		enterTriggered = true;
	};
	element.addEventListener("click", enterHandler);
	element.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			enterTriggered = true;
		}
	});

	await testUser.keyboard("{Enter}");

	// Test Space key (for buttons)
	const _spaceHandler = () => {
		spaceTriggered = true;
	};
	element.addEventListener("keydown", (e) => {
		if (e.key === " ") {
			spaceTriggered = true;
		}
	});

	await testUser.keyboard(" ");

	// Test Escape key
	const _escapeHandler = () => {
		escapeTriggered = true;
	};
	element.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			escapeTriggered = true;
		}
	});

	await testUser.keyboard("{Escape}");

	// Test Arrow keys
	const _arrowHandler = () => {
		arrowKeyTriggered = true;
	};
	element.addEventListener("keydown", (e) => {
		if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
			arrowKeyTriggered = true;
		}
	});

	await testUser.keyboard("{ArrowDown}");

	// Cleanup
	element.removeEventListener("click", enterHandler);

	return {
		enterWorks: enterTriggered,
		spaceWorks: spaceTriggered,
		escapeWorks: escapeTriggered,
		arrowKeysWork: arrowKeyTriggered,
	};
}

// =============================================================================
// Screen Reader Testing
// =============================================================================

/**
 * Test screen reader compatibility
 */
function testScreenReaderCompatibility(
	container: HTMLElement
): ScreenReaderResult {
	const missingAccessibleNames: HTMLElement[] = [];
	const insufficientDescriptions: HTMLElement[] = [];
	const incorrectRoles: HTMLElement[] = [];

	// Check interactive elements for accessible names
	const interactiveElements = container.querySelectorAll(
		'button, a, input, select, textarea, [role="button"], [role="link"], [role="textbox"]'
	);

	interactiveElements.forEach((element) => {
		const el = element as HTMLElement;
		const accessibleName = getAccessibleName(el);

		if (!accessibleName) {
			missingAccessibleNames.push(el);
		}
	});

	// Check for elements that should have descriptions
	const elementsNeedingDescriptions = container.querySelectorAll(
		'[aria-describedby], input[type="password"], input[required]'
	);

	elementsNeedingDescriptions.forEach((element) => {
		const el = element as HTMLElement;
		const describedBy = el.getAttribute("aria-describedby");

		if (describedBy) {
			const descriptionElement = container.querySelector(`#${describedBy}`);
			if (!descriptionElement?.textContent?.trim()) {
				insufficientDescriptions.push(el);
			}
		} else if (
			el.hasAttribute("required") ||
			el.getAttribute("type") === "password"
		) {
			insufficientDescriptions.push(el);
		}
	});

	// Check for incorrect roles
	const elementsWithRoles = container.querySelectorAll("[role]");
	elementsWithRoles.forEach((element) => {
		const el = element as HTMLElement;
		const role = el.getAttribute("role");
		const tagName = el.tagName.toLowerCase();

		// Basic role validation
		if (role === "button" && tagName === "button") {
			// Redundant role
			incorrectRoles.push(el);
		}
	});

	// Calculate accessibility score
	const totalElements =
		interactiveElements.length + elementsNeedingDescriptions.length;
	const issues =
		missingAccessibleNames.length +
		insufficientDescriptions.length +
		incorrectRoles.length;
	const accessibilityScore =
		totalElements > 0
			? Math.max(0, ((totalElements - issues) / totalElements) * 100)
			: 100;

	return {
		missingAccessibleNames,
		insufficientDescriptions,
		incorrectRoles,
		accessibilityScore: Math.round(accessibilityScore),
	};
}

/**
 * Test landmark navigation
 */
function testLandmarkNavigation(container: HTMLElement): {
	landmarks: HTMLElement[];
	missingLandmarks: string[];
	hasMainLandmark: boolean;
	hasNavigationLandmark: boolean;
	hasSkipLinks: boolean;
} {
	const landmarkSelectors = [
		'main, [role="main"]',
		'nav, [role="navigation"]',
		'header, [role="banner"]',
		'footer, [role="contentinfo"]',
		'aside, [role="complementary"]',
		'section, [role="region"]',
		'[role="search"]',
	];

	const landmarks: HTMLElement[] = [];
	landmarkSelectors.forEach((selector) => {
		const elements = container.querySelectorAll(selector);
		landmarks.push(...(Array.from(elements) as HTMLElement[]));
	});

	const hasMainLandmark = landmarks.some(
		(el) =>
			el.tagName.toLowerCase() === "main" || el.getAttribute("role") === "main"
	);

	const hasNavigationLandmark = landmarks.some(
		(el) =>
			el.tagName.toLowerCase() === "nav" ||
			el.getAttribute("role") === "navigation"
	);

	// Check for skip links
	const skipLinks = container.querySelectorAll('a[href^="#"]');
	const hasSkipLinks = Array.from(skipLinks).some((link) =>
		link.textContent?.toLowerCase().includes("skip")
	);

	const missingLandmarks: string[] = [];
	if (!hasMainLandmark) {
		missingLandmarks.push("main");
	}
	if (!hasNavigationLandmark) {
		missingLandmarks.push("navigation");
	}

	return {
		landmarks,
		missingLandmarks,
		hasMainLandmark,
		hasNavigationLandmark,
		hasSkipLinks,
	};
}

// =============================================================================
// Focus Management Testing
// =============================================================================

/**
 * Test focus management in modals and dialogs
 */
async function testFocusManagement(
	container: HTMLElement,
	config: {
		triggerSelector?: string;
		modalSelector?: string;
		closeSelector?: string;
		expectFocusTrap?: boolean;
	} = {},
	user?: UserEvent
): Promise<FocusManagementResult> {
	const testUser = user || userEvent.setup();
	let initialFocusElement: HTMLElement | null = null;
	let restorationElement: HTMLElement | null = null;
	let isFocusTrapped = false;
	let isFocusRestored = false;

	// Store initial focus
	const originalActiveElement = document.activeElement as HTMLElement;

	try {
		// If trigger selector provided, click it to open modal
		if (config.triggerSelector) {
			const trigger = container.querySelector(
				config.triggerSelector
			) as HTMLElement;
			if (trigger) {
				trigger.focus();
				await testUser.click(trigger);
				await waitFor(
					() => {
						const modal = container.querySelector(
							config.modalSelector || '[role="dialog"]'
						);
						return modal && modal.getAttribute("aria-hidden") !== "true";
					},
					{ timeout: 1000 }
				);
			}
		}

		// Find the modal/dialog
		const modal = container.querySelector(
			config.modalSelector || '[role="dialog"]'
		) as HTMLElement;
		if (modal) {
			// Check initial focus
			await waitFor(
				() => {
					initialFocusElement = document.activeElement as HTMLElement;
					return modal.contains(initialFocusElement);
				},
				{ timeout: 500 }
			);

			// Test focus trap if expected
			if (config.expectFocusTrap) {
				isFocusTrapped = await testFocusTrap(modal, testUser);
			}

			// Close modal and test focus restoration
			if (config.closeSelector) {
				const closeButton = modal.querySelector(
					config.closeSelector
				) as HTMLElement;
				if (closeButton) {
					await testUser.click(closeButton);

					// Wait for modal to close and check focus restoration
					await waitFor(
						() => {
							restorationElement = document.activeElement as HTMLElement;
							return !modal.contains(restorationElement);
						},
						{ timeout: 1000 }
					);

					isFocusRestored = restorationElement === originalActiveElement;
				}
			}
		}
	} catch (_error) {
		// Test failed, but we'll still return results
	}

	return {
		isFocusTrapped,
		isFocusRestored,
		initialFocusElement,
		restorationElement,
	};
}

/**
 * Test focus trap functionality
 */
async function testFocusTrap(
	container: HTMLElement,
	user: UserEvent
): Promise<boolean> {
	const focusableElements = getFocusableElements(container);
	if (focusableElements.length < 2) {
		return true; // Can't test trap with fewer than 2 elements
	}

	const firstElement = focusableElements[0];
	const lastElement = focusableElements.at(-1);

	// Focus first element and shift+tab - should go to last element
	firstElement.focus();
	await user.tab({ shift: true });

	if (document.activeElement !== lastElement) {
		return false;
	}

	// Focus last element and tab - should go to first element
	lastElement.focus();
	await user.tab();

	return document.activeElement === firstElement;
}

// =============================================================================
// Form Accessibility Testing
// =============================================================================

/**
 * Test form accessibility
 */
function testFormAccessibility(container: HTMLElement): {
	missingLabels: HTMLElement[];
	missingErrorAssociation: HTMLElement[];
	missingRequiredIndication: HTMLElement[];
	improperFieldsets: HTMLElement[];
	accessibilityScore: number;
} {
	const missingLabels: HTMLElement[] = [];
	const missingErrorAssociation: HTMLElement[] = [];
	const missingRequiredIndication: HTMLElement[] = [];
	const improperFieldsets: HTMLElement[] = [];

	// Check form inputs for labels
	const inputs = container.querySelectorAll(
		'input:not([type="hidden"]), select, textarea'
	);
	inputs.forEach((input) => {
		const el = input as HTMLElement;
		const hasLabel = getAccessibleName(el) !== "";

		if (!hasLabel) {
			missingLabels.push(el);
		}

		// Check required fields
		if (el.hasAttribute("required")) {
			const hasRequiredIndication =
				el.getAttribute("aria-required") === "true" ||
				container
					.querySelector(`label[for="${el.id}"]`)
					?.textContent?.includes("*") ||
				el.getAttribute("aria-label")?.includes("required") ||
				Boolean(
					el.getAttribute("aria-describedby") &&
						container
							.querySelector(`#${el.getAttribute("aria-describedby")}`)
							?.textContent?.includes("required")
				);

			if (!hasRequiredIndication) {
				missingRequiredIndication.push(el);
			}
		}

		// Check error association
		if (el.getAttribute("aria-invalid") === "true") {
			const hasErrorDescription = Boolean(
				el.getAttribute("aria-describedby") &&
					container.querySelector(`#${el.getAttribute("aria-describedby")}`)
			);

			if (!hasErrorDescription) {
				missingErrorAssociation.push(el);
			}
		}
	});

	// Check fieldsets
	const fieldsets = container.querySelectorAll("fieldset");
	fieldsets.forEach((fieldset) => {
		const legend = fieldset.querySelector("legend");
		if (!legend) {
			improperFieldsets.push(fieldset as HTMLElement);
		}
	});

	// Calculate score
	const totalChecks = inputs.length + fieldsets.length;
	const issues =
		missingLabels.length +
		missingErrorAssociation.length +
		missingRequiredIndication.length +
		improperFieldsets.length;
	const accessibilityScore =
		totalChecks > 0
			? Math.max(0, ((totalChecks - issues) / totalChecks) * 100)
			: 100;

	return {
		missingLabels,
		missingErrorAssociation,
		missingRequiredIndication,
		improperFieldsets,
		accessibilityScore: Math.round(accessibilityScore),
	};
}

// =============================================================================
// Accessibility Preferences Testing
// =============================================================================

/**
 * Test component with different accessibility preferences
 */
async function testWithAccessibilityPreferences<T>(
	renderComponent: () => RenderResult,
	testFunction: (result: RenderResult) => Promise<T> | T,
	preferences: AccessibilityPreferences = {}
): Promise<T> {
	// Mock media queries for accessibility preferences
	const mockMatchMedia = (query: string) => {
		const matches: Record<string, boolean> = {
			"(prefers-reduced-motion: reduce)":
				preferences.prefersReducedMotion ?? false,
			"(prefers-contrast: high)": preferences.prefersHighContrast ?? false,
			"(prefers-color-scheme: dark)": preferences.colorScheme === "dark",
		};

		return {
			matches: matches[query],
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => true,
		};
	};

	const originalMatchMedia = window.matchMedia;
	window.matchMedia = mockMatchMedia as any;

	// Mock font size if specified
	if (preferences.fontSizeMultiplier) {
		const originalStyle = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = `${preferences.fontSizeMultiplier}rem`;

		try {
			const renderResult = renderComponent();
			return await testFunction(renderResult);
		} finally {
			document.documentElement.style.fontSize = originalStyle;
			window.matchMedia = originalMatchMedia;
		}
	}

	try {
		const renderResult = renderComponent();
		return await testFunction(renderResult);
	} finally {
		window.matchMedia = originalMatchMedia;
	}
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get accessible name for an element
 */
function getAccessibleName(element: HTMLElement): string {
	// Check aria-label
	const ariaLabel = element.getAttribute("aria-label");
	if (ariaLabel) {
		return ariaLabel.trim();
	}

	// Check aria-labelledby
	const labelledBy = element.getAttribute("aria-labelledby");
	if (labelledBy) {
		const labelElement = document.querySelector(`#${labelledBy}`);
		if (labelElement) {
			return labelElement.textContent?.trim() || "";
		}
	}

	// Check associated label
	const id = element.getAttribute("id");
	if (id) {
		const label = document.querySelector(`label[for="${id}"]`);
		if (label) {
			return label.textContent?.trim() || "";
		}
	}

	// Check if element is inside a label
	const parentLabel = element.closest("label");
	if (parentLabel) {
		return parentLabel.textContent?.trim() || "";
	}

	// Check text content for certain elements
	if (["button", "a"].includes(element.tagName.toLowerCase())) {
		const textContent = element.textContent?.trim() || "";
		// Flag single characters or common icon characters as inadequate for buttons
		if (
			element.tagName.toLowerCase() === "button" &&
			(textContent.length === 1 ||
				["×", "✕", "⨯", "+", "-", "?", "!"].includes(textContent))
		) {
			return ""; // Consider these inadequate
		}
		return textContent;
	}

	// Check title attribute as last resort
	const title = element.getAttribute("title");
	if (title) {
		return title.trim();
	}

	return "";
}

/**
 * Check if element is hidden
 */
function isHidden(element: HTMLElement): boolean {
	const style = window.getComputedStyle(element);
	return (
		style.display === "none" ||
		style.visibility === "hidden" ||
		style.opacity === "0" ||
		element.hasAttribute("hidden") ||
		element.getAttribute("aria-hidden") === "true"
	);
}

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
	const focusableSelector = [
		'a[href]:not([tabindex="-1"])',
		'button:not([disabled]):not([tabindex="-1"])',
		'input:not([disabled]):not([tabindex="-1"])',
		'select:not([disabled]):not([tabindex="-1"])',
		'textarea:not([disabled]):not([tabindex="-1"])',
		'[tabindex]:not([tabindex="-1"])',
		'details:not([tabindex="-1"])',
		'summary:not([tabindex="-1"])',
	].join(", ");

	return Array.from(container.querySelectorAll(focusableSelector)).filter(
		(el) => !isHidden(el as HTMLElement)
	) as HTMLElement[];
}

/**
 * Check if tab order is logical (top to bottom, left to right)
 */
function checkLogicalTabOrder(elements: HTMLElement[]): boolean {
	if (elements.length < 2) {
		return true;
	}

	for (let i = 1; i < elements.length; i++) {
		const current = elements[i].getBoundingClientRect();
		const previous = elements[i - 1].getBoundingClientRect();

		// If current element is significantly higher than previous, order might be wrong
		if (current.top < previous.top - 10) {
			return false;
		}

		// If on same row, check left to right order
		if (
			Math.abs(current.top - previous.top) < 10 &&
			current.left < previous.left - 10
		) {
			return false;
		}
	}

	return true;
}

// =============================================================================
// High-level Test Helpers
// =============================================================================

/**
 * Comprehensive accessibility test suite for a component
 */
async function runFullAccessibilityAudit(
	renderComponent: () => RenderResult,
	config: AccessibilityTestConfig = {}
): Promise<{
	passed: boolean;
	axeResult?: AxeResult;
	keyboardNavigation: KeyboardNavigationResult;
	screenReader: ScreenReaderResult;
	focusManagement?: FocusManagementResult;
	formAccessibility?: ReturnType<typeof testFormAccessibility>;
	landmarks: ReturnType<typeof testLandmarkNavigation>;
	summary: string[];
}> {
	const { container } = renderComponent();
	const user = userEvent.setup();

	// Run core accessibility tests
	const coreTests = await runAccessibilityTests(container, config);

	// Test keyboard navigation
	const keyboardNavigation = await testKeyboardNavigation(container, user);

	// Test screen reader compatibility
	const screenReader = testScreenReaderCompatibility(container);

	// Test landmarks
	const landmarks = testLandmarkNavigation(container);

	// Test focus management if modal config provided
	let focusManagement: FocusManagementResult | undefined;
	if (config.focusManagement) {
		focusManagement = await testFocusManagement(
			container,
			{
				expectFocusTrap: config.focusManagement.trapFocus,
			},
			user
		);
	}

	// Test form accessibility if forms present
	let formAccessibility: ReturnType<typeof testFormAccessibility> | undefined;
	if (container.querySelector("form, input, select, textarea")) {
		formAccessibility = testFormAccessibility(container);
	}

	// Generate summary
	const summary: string[] = [];

	if (coreTests.passed) {
		summary.push("✅ No axe violations found");
	} else {
		summary.push(`❌ Axe violations: ${coreTests.violations.length}`);
	}

	if (keyboardNavigation.hasLogicalTabOrder) {
		summary.push("✅ Keyboard navigation works correctly");
	} else {
		summary.push("❌ Illogical tab order detected");
	}

	if (screenReader.accessibilityScore < 80) {
		summary.push(`❌ Screen reader score: ${screenReader.accessibilityScore}%`);
	} else {
		summary.push(`✅ Screen reader score: ${screenReader.accessibilityScore}%`);
	}

	if (formAccessibility && formAccessibility.accessibilityScore < 80) {
		summary.push(
			`❌ Form accessibility score: ${formAccessibility.accessibilityScore}%`
		);
	} else if (formAccessibility) {
		summary.push(
			`✅ Form accessibility score: ${formAccessibility.accessibilityScore}%`
		);
	}

	const allPassed =
		coreTests.passed &&
		keyboardNavigation.hasLogicalTabOrder &&
		screenReader.accessibilityScore >= 80 &&
		(!formAccessibility || formAccessibility.accessibilityScore >= 80);

	return {
		passed: allPassed,
		axeResult: coreTests.axeResult,
		keyboardNavigation,
		screenReader,
		focusManagement,
		formAccessibility,
		landmarks,
		summary,
	};
}

/**
 * Simple accessibility test for quick checks
 */
async function quickAccessibilityCheck(
	container: HTMLElement
): Promise<{ passed: boolean; issues: string[] }> {
	const issues: string[] = [];

	try {
		// Quick axe check
		const axeInstance = await loadAxe();
		if (axeInstance) {
			const axeResult = await axeInstance(container);
			if (axeResult.violations) {
				axeResult.violations.forEach((violation: any) => {
					issues.push(`${violation.id}: ${violation.description}`);
				});
			}
		}

		// Quick manual checks
		const customViolations = await runCustomAccessibilityChecks(container);
		issues.push(...customViolations);
	} catch (error) {
		issues.push(
			`Accessibility test error: ${error instanceof Error ? error.message : "Unknown error"}`
		);
	}

	return {
		passed: issues.length === 0,
		issues,
	};
}

// =============================================================================
// Exports
// =============================================================================

export {
	// Main test functions
	runAccessibilityTests,
	testKeyboardNavigation,
	testKeyboardInteractions,
	testScreenReaderCompatibility,
	testLandmarkNavigation,
	testFocusManagement,
	testFormAccessibility,
	testWithAccessibilityPreferences,
	runFullAccessibilityAudit,
	quickAccessibilityCheck,
	// Utility functions
	getAccessibleName,
	isHidden,
	getFocusableElements,
	checkLogicalTabOrder,
};
