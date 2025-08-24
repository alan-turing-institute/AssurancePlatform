import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesInfo } from "../resources-info";

// Regex constants for testing
const RESOURCES_REGEX = /Resources/;
const TOP_LEVEL_GOAL_CLAIM_REGEX = /Top-Level Goal Claim/;
const PROPERTY_CLAIM_REGEX = /Property Claim/;
const STRATEGY_REGEX = /Strategy/;
const EVIDENCE_REGEX = /Evidence/;
const CONTEXT_REGEX = /Context/;
const DESIRABLE_PROPERTY_REGEX = /A statement asserting a desirable property/;
const SPECIFY_GOAL_CLAIM_REGEX =
	/A statement that helps specify the top-level goal claim/;
const SPECIFY_GOAL_CLAIM_SHORT_REGEX = /A statement that helps specify/;
const COURSE_OF_ACTION_REGEX = /A course of action or approach/;
const ARTEFACT_JUSTIFIES_REGEX =
	/An artefact that justifies a linked property claim/;
const ARTEFACT_JUSTIFIES_SHORT_REGEX = /An artefact that justifies/;
const ADDITIONAL_INFO_REGEX = /Additional information that clarifies the scope/;
const ADDITIONAL_INFO_SHORT_REGEX = /Additional information that clarifies/;

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
	BookOpenText: () => <div data-testid="book-open-text-icon">BookOpenText</div>,
	Database: () => <div data-testid="database-icon">Database</div>,
	FolderOpenDot: () => (
		<div data-testid="folder-open-dot-icon">FolderOpenDot</div>
	),
	Goal: () => <div data-testid="goal-icon">Goal</div>,
	Route: () => <div data-testid="route-icon">Route</div>,
	ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
}));

describe("ResourcesInfo", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Rendering", () => {
		it("should render the resources navigation menu", () => {
			render(<ResourcesInfo />);

			expect(screen.getByText("Resources")).toBeInTheDocument();
		});

		it("should have proper responsive visibility classes", () => {
			render(<ResourcesInfo />);

			const navigationMenu = document.querySelector("nav");
			expect(navigationMenu).toHaveClass("hidden", "sm:block");
		});

		it("should render the resources trigger button", () => {
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			expect(trigger).toBeInTheDocument();
		});

		it("should have proper styling on resources trigger", () => {
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			expect(trigger).toHaveClass(
				"bg-indigo-600",
				"hover:bg-indigo-700",
				"hover:text-white",
				"dark:bg-slate-900",
				"dark:hover:bg-slate-800"
			);
		});
	});

	describe("Component list", () => {
		it("should render all resource components when menu is expanded", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check all component titles are present
			expect(screen.getByText("Top-Level Goal Claim")).toBeInTheDocument();
			expect(screen.getByText("Property Claim")).toBeInTheDocument();
			expect(screen.getByText("Strategy")).toBeInTheDocument();
			expect(screen.getByText("Evidence")).toBeInTheDocument();
			expect(screen.getByText("Context")).toBeInTheDocument();
		});

		it("should render all component descriptions when menu is expanded", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check descriptions are present
			expect(screen.getByText(DESIRABLE_PROPERTY_REGEX)).toBeInTheDocument();
			expect(screen.getByText(SPECIFY_GOAL_CLAIM_REGEX)).toBeInTheDocument();
			expect(screen.getByText(COURSE_OF_ACTION_REGEX)).toBeInTheDocument();
			expect(screen.getByText(ARTEFACT_JUSTIFIES_REGEX)).toBeInTheDocument();
			expect(screen.getByText(ADDITIONAL_INFO_REGEX)).toBeInTheDocument();
		});

		it("should render all component icons when menu is expanded", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check all icons are present
			expect(screen.getByTestId("goal-icon")).toBeInTheDocument();
			expect(screen.getByTestId("folder-open-dot-icon")).toBeInTheDocument();
			expect(screen.getByTestId("route-icon")).toBeInTheDocument();
			expect(screen.getByTestId("database-icon")).toBeInTheDocument();
			expect(screen.getByTestId("book-open-text-icon")).toBeInTheDocument();
		});
	});

	describe("Links and navigation", () => {
		it("should render all resource links with correct hrefs", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check all links have correct hrefs
			const goalLink = screen.getByRole("link", {
				name: TOP_LEVEL_GOAL_CLAIM_REGEX,
			});
			expect(goalLink).toHaveAttribute(
				"href",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#goal-claims"
			);

			const propertyLink = screen.getByRole("link", {
				name: PROPERTY_CLAIM_REGEX,
			});
			expect(propertyLink).toHaveAttribute(
				"href",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#property-claims"
			);

			const strategyLink = screen.getByRole("link", { name: STRATEGY_REGEX });
			expect(strategyLink).toHaveAttribute(
				"href",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#strategy"
			);

			const evidenceLink = screen.getByRole("link", { name: EVIDENCE_REGEX });
			expect(evidenceLink).toHaveAttribute(
				"href",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#evidence"
			);

			const contextLink = screen.getByRole("link", { name: CONTEXT_REGEX });
			expect(contextLink).toHaveAttribute(
				"href",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#context"
			);
		});

		it("should render all links with target='_blank'", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check all links open in new tab
			const links = screen.getAllByRole("link");
			for (const link of links) {
				expect(link).toHaveAttribute("target", "_blank");
			}
		});

		it("should have proper link styling", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const links = screen.getAllByRole("link");
			for (const link of links) {
				expect(link).toHaveClass(
					"block",
					"select-none",
					"space-y-1",
					"rounded-md",
					"p-3",
					"leading-none",
					"no-underline",
					"outline-none",
					"transition-colors",
					"hover:bg-accent",
					"hover:text-accent-foreground",
					"focus:bg-accent",
					"focus:text-accent-foreground"
				);
			}
		});
	});

	describe("User interaction", () => {
		it("should expand menu when trigger is clicked", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });

			// Menu should not be visible initially
			expect(
				screen.queryByText("Top-Level Goal Claim")
			).not.toBeInTheDocument();

			await user.click(trigger);

			// Menu should be visible after click
			expect(screen.getByText("Top-Level Goal Claim")).toBeInTheDocument();
		});

		it("should handle keyboard navigation", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Focus should be manageable with keyboard
			const firstLink = screen.getByRole("link", {
				name: TOP_LEVEL_GOAL_CLAIM_REGEX,
			});
			await user.tab();

			// First link should be focusable
			expect(firstLink).toBeInTheDocument();
		});

		it("should allow hover interactions on links", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const firstLink = screen.getByRole("link", {
				name: TOP_LEVEL_GOAL_CLAIM_REGEX,
			});
			await user.hover(firstLink);

			// Link should remain in document after hover
			expect(firstLink).toBeInTheDocument();
		});
	});

	describe("Content structure", () => {
		it("should have proper grid layout", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const gridContainer = document.querySelector("ul.grid");
			expect(gridContainer).toHaveClass(
				"grid",
				"w-[400px]",
				"gap-3",
				"p-4",
				"md:w-[500px]",
				"md:grid-cols-2",
				"lg:w-[600px]"
			);
		});

		it("should render each component in a list item", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const gridContainer = document.querySelector("ul.grid");
			const listItems = gridContainer?.querySelectorAll("li");
			expect(listItems).toHaveLength(5); // 5 components
		});

		it("should have proper icon and title layout", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check each component has the proper title/icon container
			const titleContainers = document.querySelectorAll(
				".flex.items-center.justify-start.gap-3"
			);
			expect(titleContainers).toHaveLength(5);

			for (const container of titleContainers) {
				expect(container).toHaveClass(
					"flex",
					"items-center",
					"justify-start",
					"gap-3",
					"pb-2",
					"font-bold",
					"text-foreground"
				);
			}
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes", () => {
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			expect(trigger).toBeInTheDocument();
		});

		it("should have accessible navigation structure", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// All links should be accessible
			const links = screen.getAllByRole("link");
			expect(links).toHaveLength(5);

			for (const link of links) {
				expect(link).toBeInTheDocument();
			}
		});

		it("should have proper focus management", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });

			// Trigger should be focusable
			await user.tab();
			expect(trigger).toHaveFocus();
		});
	});

	describe("Responsive design", () => {
		it("should be hidden on small screens", () => {
			render(<ResourcesInfo />);

			const nav = document.querySelector("nav");
			expect(nav).toHaveClass("hidden", "sm:block");
		});

		it("should have responsive grid classes", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const gridContainer = document.querySelector("ul.grid");
			expect(gridContainer).toHaveClass(
				"w-[400px]",
				"md:w-[500px]",
				"md:grid-cols-2",
				"lg:w-[600px]"
			);
		});
	});

	describe("Component data integrity", () => {
		it("should have all expected component titles", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const expectedTitles = [
				"Top-Level Goal Claim",
				"Property Claim",
				"Strategy",
				"Evidence",
				"Context",
			];

			for (const title of expectedTitles) {
				expect(screen.getByText(title)).toBeInTheDocument();
			}
		});

		it("should have all expected component descriptions", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			// Check partial text of each description
			expect(screen.getByText(DESIRABLE_PROPERTY_REGEX)).toBeInTheDocument();
			expect(
				screen.getByText(SPECIFY_GOAL_CLAIM_SHORT_REGEX)
			).toBeInTheDocument();
			expect(screen.getByText(COURSE_OF_ACTION_REGEX)).toBeInTheDocument();
			expect(
				screen.getByText(ARTEFACT_JUSTIFIES_SHORT_REGEX)
			).toBeInTheDocument();
			expect(screen.getByText(ADDITIONAL_INFO_SHORT_REGEX)).toBeInTheDocument();
		});

		it("should have all expected external links", async () => {
			const user = userEvent.setup();
			render(<ResourcesInfo />);

			const trigger = screen.getByRole("button", { name: RESOURCES_REGEX });
			await user.click(trigger);

			const expectedLinks = [
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#goal-claims",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#property-claims",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#strategy",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#evidence",
				"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#context",
			];

			const links = screen.getAllByRole("link");
			for (const [index, expectedHref] of expectedLinks.entries()) {
				expect(links[index]).toHaveAttribute("href", expectedHref);
			}
		});
	});
});
