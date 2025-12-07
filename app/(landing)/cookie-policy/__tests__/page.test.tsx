import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import CookiePolicyPage from "../page";

// Top-level regex patterns for performance
const GENERAL_DATA_PROTECTION_REGULATION_REGEX =
	/General Data Protection Regulation/;
const GDPR_REGEX = /GDPR/;
const ARTICLE_6_REGEX = /Article 6\(1\)\(b\)/;
const GITHUB_REGEX = /GitHub/;
const THIRD_PARTY_PROVIDER_REGEX = /third-party provider/;
const CANNOT_OPT_OUT_REGEX = /cannot opt-out of these essential cookies/;
const MANAGE_DELETE_COOKIES_REGEX =
	/manage or delete cookies through your browser/;
const CLICK_HERE_REGEX = /click here/i;
const COOKIE_NOTICE_EXPLAINS_REGEX = /Cookie Notice explains how/;
const SMALL_TEXT_FILES_REGEX = /small text files/;
const EXCLUSIVELY_FOR_ESSENTIAL_REGEX =
	/exclusively for essential functionalities/;
const AUTHENTICATION_SESSION_REGEX = /authentication and session management/;
const UPDATE_COOKIE_NOTICE_REGEX =
	/may update this Cookie Notice from time to time/;
const REVIEW_NOTICE_REGEX = /review this notice periodically/;
const COOKIE_NOTICE_EXPLAINS_TRUSTWORTHY_REGEX =
	/This Cookie Notice explains how the Trustworthy and Ethical Assurance/;
const WE_US_OUR_REGEX = /\("we", "us", or "our"\)/;
const THE_PLATFORM_REGEX = /\(the "Platform"\)/;
const BROWSER_SETTINGS_REGEX = /browser settings/;
const HELP_SECTION_REGEX = /Help.*section/;

describe("CookiePolicyPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Page Rendering", () => {
		it("should render without crashing", () => {
			render(<CookiePolicyPage />);
			expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		});

		it("should display the correct page title", () => {
			render(<CookiePolicyPage />);
			const title = screen.getByRole("heading", {
				level: 1,
				name: "Cookie Notice for the Trustworthy and Ethical Assurance Platform",
			});
			expect(title).toBeInTheDocument();
		});

		it("should render all section headings", () => {
			render(<CookiePolicyPage />);

			const expectedHeadings = [
				"What are Cookies?",
				"How We Use Cookies",
				"Types of Cookies We Use (Essential Cookies)",
				"Why These Cookies Are Essential",
				"Your Choices Regarding Cookies",
				"Data Protection and GDPR Compliance",
				"Third-Party Cookies",
				"Changes to This Cookie Notice",
				"Contact Us",
			];

			for (const heading of expectedHeadings) {
				expect(
					screen.getByRole("heading", { name: heading })
				).toBeInTheDocument();
			}
		});

		it("should display the platform URL link", () => {
			render(<CookiePolicyPage />);
			const platformLink = screen.getByRole("link", {
				name: "https://assuranceplatform.azurewebsites.net/",
			});
			expect(platformLink).toBeInTheDocument();
			expect(platformLink).toHaveAttribute(
				"href",
				"https://assuranceplatform.azurewebsites.net/"
			);
		});

		it("should display the GitHub issues link", () => {
			render(<CookiePolicyPage />);
			const githubLink = screen.getByRole("link", {
				name: "https://github.com/alan-turing-institute/AssurancePlatform/issues",
			});
			expect(githubLink).toBeInTheDocument();
			expect(githubLink).toHaveAttribute(
				"href",
				" https://github.com/alan-turing-institute/AssurancePlatform/issues"
			);
		});
	});

	describe("Cookie Information", () => {
		it("should list all essential cookies with their details", () => {
			render(<CookiePolicyPage />);

			// Check for cookie names
			expect(screen.getByText("next-auth.csrf-token")).toBeInTheDocument();
			expect(screen.getByText("next-auth.callback-url")).toBeInTheDocument();
			expect(screen.getByText("next-auth.session-token")).toBeInTheDocument();
		});

		it("should display what cookies are NOT used for", () => {
			render(<CookiePolicyPage />);

			const notUsedFor = [
				"Tracking your browsing activity across other websites.",
				"Marketing or advertising purposes.",
				"Analytics on anonymous users before login.",
			];

			for (const text of notUsedFor) {
				expect(screen.getByText(text)).toBeInTheDocument();
			}
		});

		it("should explain why cookies are essential", () => {
			render(<CookiePolicyPage />);

			const essentialReasons = [
				"They enable you to log in and access secure areas of the Platform.",
				"They help maintain the security and integrity of your session.",
				"The Platform cannot provide the authenticated services you request without them.",
			];

			for (const text of essentialReasons) {
				expect(screen.getByText(text)).toBeInTheDocument();
			}
		});
	});

	describe("Visual Elements", () => {
		it("should render CheckCircleIcon for essential cookies", () => {
			const { container } = render(<CookiePolicyPage />);

			// Look for CheckCircleIcons by their class and SVG element
			const checkIcons = container.querySelectorAll("svg.text-emerald-600");

			// Should have 3 check icons for the 3 essential cookies
			expect(checkIcons).toHaveLength(3);
		});

		it("should render XCircleIcon for non-used cookie purposes", () => {
			const { container } = render(<CookiePolicyPage />);

			// Look for XCircleIcons by their class and SVG element
			const xIcons = container.querySelectorAll("svg.text-rose-600");

			// Should have 3 X icons for the 3 things cookies are NOT used for
			expect(xIcons).toHaveLength(3);
		});
	});

	describe("Content Structure", () => {
		it("should have proper paragraph structure for cookie descriptions", () => {
			render(<CookiePolicyPage />);

			// Check that cookie purposes are properly labeled
			const purposeLabels = screen.getAllByText("Purpose:");
			expect(purposeLabels.length).toBeGreaterThan(0);

			const durationLabels = screen.getAllByText("Duration:");
			expect(durationLabels.length).toBeGreaterThan(0);
		});

		it("should include GDPR compliance information", () => {
			render(<CookiePolicyPage />);

			// Check for GDPR-related content
			expect(
				screen.getByText(GENERAL_DATA_PROTECTION_REGULATION_REGEX)
			).toBeInTheDocument();
			const gdprElements = screen.getAllByText(GDPR_REGEX);
			expect(gdprElements.length).toBeGreaterThan(0);
			expect(screen.getByText(ARTICLE_6_REGEX)).toBeInTheDocument();
		});

		it("should mention third-party authentication providers", () => {
			render(<CookiePolicyPage />);

			// Check for GitHub mention
			const githubElements = screen.getAllByText(GITHUB_REGEX);
			expect(githubElements.length).toBeGreaterThan(0);
			expect(screen.getByText(THIRD_PARTY_PROVIDER_REGEX)).toBeInTheDocument();
		});

		it("should include user choice information", () => {
			render(<CookiePolicyPage />);

			// Check for user choice content
			expect(screen.getByText(CANNOT_OPT_OUT_REGEX)).toBeInTheDocument();
			expect(screen.getByText(MANAGE_DELETE_COOKIES_REGEX)).toBeInTheDocument();
		});
	});

	describe("Layout and Styling", () => {
		it("should have correct container classes", () => {
			const { container } = render(<CookiePolicyPage />);

			const mainDiv = container.firstChild;
			expect(mainDiv).toHaveClass("bg-white", "px-6", "py-32", "lg:px-8");
		});

		it("should have correct content wrapper classes", () => {
			render(<CookiePolicyPage />);

			const contentWrapper = screen.getByRole("heading", {
				level: 1,
			}).parentElement;
			expect(contentWrapper).toHaveClass(
				"mx-auto",
				"max-w-3xl",
				"text-base/7",
				"text-gray-700"
			);
		});

		it("should style links appropriately", () => {
			render(<CookiePolicyPage />);

			const links = screen.getAllByRole("link");
			for (const link of links) {
				expect(link).toHaveClass("text-indigo-600", "underline");
			}
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<CookiePolicyPage />);
			const results = await axe(container);
			expect(results.violations).toHaveLength(0);
		});

		it("should have proper heading hierarchy", () => {
			render(<CookiePolicyPage />);

			// Should have exactly one h1
			const h1Elements = screen.getAllByRole("heading", { level: 1 });
			expect(h1Elements).toHaveLength(1);

			// Should have multiple h2 elements
			const h2Elements = screen.getAllByRole("heading", { level: 2 });
			expect(h2Elements.length).toBeGreaterThan(0);
		});

		it("should have descriptive link text", () => {
			render(<CookiePolicyPage />);

			const links = screen.getAllByRole("link");
			for (const link of links) {
				// Links should have meaningful text, not generic "click here"
				expect(link.textContent).not.toMatch(CLICK_HERE_REGEX);
				expect(link.textContent?.length).toBeGreaterThan(0);
			}
		});

		it("should use semantic HTML elements", () => {
			const { container } = render(<CookiePolicyPage />);

			// Check for semantic list elements
			const unorderedLists = container.querySelectorAll("ul");
			expect(unorderedLists.length).toBeGreaterThan(0);

			// Check that list items are properly nested
			for (const ul of unorderedLists) {
				const listItems = ul.querySelectorAll("li");
				expect(listItems.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Content Completeness", () => {
		it("should include all required cookie policy sections", () => {
			render(<CookiePolicyPage />);

			// Check for key policy content
			expect(
				screen.getByText(COOKIE_NOTICE_EXPLAINS_REGEX)
			).toBeInTheDocument();
			expect(screen.getByText(SMALL_TEXT_FILES_REGEX)).toBeInTheDocument();
			expect(
				screen.getByText(EXCLUSIVELY_FOR_ESSENTIAL_REGEX)
			).toBeInTheDocument();
			expect(
				screen.getByText(AUTHENTICATION_SESSION_REGEX)
			).toBeInTheDocument();
		});

		it("should include update policy information", () => {
			render(<CookiePolicyPage />);

			expect(screen.getByText(UPDATE_COOKIE_NOTICE_REGEX)).toBeInTheDocument();
			expect(screen.getByText(REVIEW_NOTICE_REGEX)).toBeInTheDocument();
		});

		it("should include browser settings information", () => {
			render(<CookiePolicyPage />);

			expect(screen.getByText(BROWSER_SETTINGS_REGEX)).toBeInTheDocument();
			expect(screen.getByText(HELP_SECTION_REGEX)).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle text wrapping for long URLs", () => {
			render(<CookiePolicyPage />);

			// URLs should be rendered as links
			const urlLinks = screen
				.getAllByRole("link")
				.filter((link) => link.textContent?.startsWith("https://"));
			expect(urlLinks.length).toBeGreaterThan(0);
		});

		it("should properly escape special characters in text", () => {
			render(<CookiePolicyPage />);

			// Check that quotes are properly rendered in the content
			const mainContent = screen.getByText(
				COOKIE_NOTICE_EXPLAINS_TRUSTWORTHY_REGEX
			);
			expect(mainContent).toBeInTheDocument();

			// Check for quoted text in the page
			expect(screen.getByText(WE_US_OUR_REGEX)).toBeInTheDocument();
			expect(screen.getByText(THE_PLATFORM_REGEX)).toBeInTheDocument();
		});
	});
});
