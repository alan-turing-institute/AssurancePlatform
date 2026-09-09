import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import PrivacyPolicyPage from "../page";

// Top-level regex patterns for performance
const DRIVE_FILE_SENTENCE_REGEX =
	/we ask for the.*permission\. This lets the Platform see, create and change/;
const GOOGLE_API_POLICY_REGEX = /Google API Services User Data Policy/;
const CHRIS_PLACEHOLDER_REGEX = /\[Chris: confirm the Institute/;
const KEPT_UNDER_ADMIN_REGEX = /kept under that Admin/;
const NO_OTHER_ADMIN_DELETED_REGEX = /no other Admin are deleted/;
const NAME_REMOVED_FROM_COMMENTS_REGEX = /name is removed from comments/;
const TWO_YEARS_REGEX = /two years/;
const THIRTY_DAYS_REGEX = /30 days/;
const SEVEN_DAYS_REGEX = /7 days/;

describe("PrivacyPolicyPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Page Rendering", () => {
		it("should render without crashing", () => {
			render(<PrivacyPolicyPage />);
			expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		});

		it("should display the correct page title", () => {
			render(<PrivacyPolicyPage />);
			const title = screen.getByRole("heading", {
				level: 1,
				name: "Privacy Notice for the Trustworthy and Ethical Assurance Platform",
			});
			expect(title).toBeInTheDocument();
		});

		it("should render all section headings", () => {
			render(<PrivacyPolicyPage />);

			const expectedHeadings = [
				"What we collect",
				"Why we use it",
				"Google user data",
				"How long we keep it",
				"Deleting your data",
				"Where it is stored",
				"Changes and questions",
			];

			for (const heading of expectedHeadings) {
				expect(
					screen.getByRole("heading", { name: heading })
				).toBeInTheDocument();
			}
		});
	});

	describe("Content Completeness", () => {
		it("should describe the drive.file scope", () => {
			render(<PrivacyPolicyPage />);

			expect(screen.getByText("drive.file")).toBeInTheDocument();
			expect(screen.getByText(DRIVE_FILE_SENTENCE_REGEX)).toBeInTheDocument();
		});

		it("should link to the data retention policy", () => {
			render(<PrivacyPolicyPage />);

			const retentionLink = screen.getByRole("link", {
				name: "Data Retention Policy",
			});
			expect(retentionLink).toBeInTheDocument();
			expect(retentionLink).toHaveAttribute(
				"href",
				"/docs/data-retention-policy"
			);
		});

		it("should link to the Cookie Notice", () => {
			render(<PrivacyPolicyPage />);

			const cookieLink = screen.getByRole("link", { name: "Cookie Notice" });
			expect(cookieLink).toBeInTheDocument();
			expect(cookieLink).toHaveAttribute("href", "/cookie-policy");
		});

		it("should open external Google links in a new tab", () => {
			render(<PrivacyPolicyPage />);

			const googlePolicyLink = screen.getByRole("link", {
				name: GOOGLE_API_POLICY_REGEX,
			});
			expect(googlePolicyLink).toHaveAttribute("target", "_blank");
			expect(googlePolicyLink).toHaveAttribute("rel", "noopener noreferrer");
		});

		it("should render the unresolved Chris placeholders as visible text", () => {
			render(<PrivacyPolicyPage />);

			expect(screen.getByText(CHRIS_PLACEHOLDER_REGEX)).toBeInTheDocument();
		});

		it("should list all six categories of data collected", () => {
			render(<PrivacyPolicyPage />);

			const bulletLeaders = [
				"Account details.",
				"Sign-in identifiers.",
				"Google Drive access tokens.",
				"Your content.",
				"Activity and security records.",
				"Emails we send you.",
			];

			for (const leader of bulletLeaders) {
				expect(screen.getByText(leader)).toBeInTheDocument();
			}
		});

		it("should explain what happens to cases and comments on deletion", () => {
			render(<PrivacyPolicyPage />);

			expect(screen.getByText(KEPT_UNDER_ADMIN_REGEX)).toBeInTheDocument();
			expect(
				screen.getByText(NO_OTHER_ADMIN_DELETED_REGEX)
			).toBeInTheDocument();
			expect(
				screen.getByText(NAME_REMOVED_FROM_COMMENTS_REGEX)
			).toBeInTheDocument();
		});

		it("should state the retention timelines", () => {
			render(<PrivacyPolicyPage />);

			expect(screen.getByText(TWO_YEARS_REGEX)).toBeInTheDocument();
			expect(screen.getByText(THIRTY_DAYS_REGEX)).toBeInTheDocument();
			expect(screen.getByText(SEVEN_DAYS_REGEX)).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<PrivacyPolicyPage />);
			const results = await axe(container);
			expect(results.violations).toHaveLength(0);
		});

		it("should have proper heading hierarchy", () => {
			render(<PrivacyPolicyPage />);

			// Should have exactly one h1
			const h1Elements = screen.getAllByRole("heading", { level: 1 });
			expect(h1Elements).toHaveLength(1);

			// Should have multiple h2 elements
			const h2Elements = screen.getAllByRole("heading", { level: 2 });
			expect(h2Elements.length).toBeGreaterThan(0);
		});
	});
});
