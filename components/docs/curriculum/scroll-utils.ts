/**
 * Scroll Navigation Utilities
 *
 * Utilities for smooth scrolling to sections within curriculum pages.
 * Used by the progress tracker to navigate to task locations.
 */

/**
 * Scroll smoothly to an element by its ID
 *
 * @param sectionId - The id attribute of the element to scroll to
 * @param offset - Optional offset from the top (useful for fixed headers)
 * @returns true if element was found and scrolled to, false otherwise
 */
export const scrollToSection = (sectionId: string, offset = 80): boolean => {
	if (typeof window === "undefined") {
		return false;
	}

	const element = document.getElementById(sectionId);

	if (!element) {
		console.warn(`scrollToSection: Element with id "${sectionId}" not found`);
		return false;
	}

	const elementPosition = element.getBoundingClientRect().top;
	const offsetPosition = elementPosition + window.scrollY - offset;

	window.scrollTo({
		top: offsetPosition,
		behavior: "smooth",
	});

	// Optionally highlight the element briefly
	element.classList.add("scroll-highlight");
	setTimeout(() => {
		element.classList.remove("scroll-highlight");
	}, 2000);

	return true;
};

/**
 * Check if an element with the given ID exists in the document
 */
export const sectionExists = (sectionId: string): boolean => {
	if (typeof window === "undefined") {
		return false;
	}
	return document.getElementById(sectionId) !== null;
};

/**
 * Get the URL for a specific page and section
 *
 * @param basePath - Base path for the curriculum module
 * @param page - Page identifier (e.g., "exploration", "reflection")
 * @param section - Optional section ID within the page
 * @returns Full URL path
 */
export const getPageUrl = (
	basePath: string,
	page: string,
	section?: string | null
): string => {
	const pagePath = `${basePath}/${page}`;
	if (section) {
		return `${pagePath}#${section}`;
	}
	return pagePath;
};

export default {
	scrollToSection,
	sectionExists,
	getPageUrl,
};
