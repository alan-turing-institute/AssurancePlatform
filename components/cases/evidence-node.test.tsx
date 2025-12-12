import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithReactFlowAndAuth,
	screen,
} from "@/src/__tests__/utils/test-utils";
import EvidenceNode from "./evidence-node";

// Mock ReactFlow components
vi.mock("reactflow", async () => {
	const actual = await vi.importActual("reactflow");
	return {
		...actual,
		Handle: ({ type, position }: { type: string; position: string }) => (
			<div data-position={position} data-testid={`handle-${type}`}>
				Handle {type}
			</div>
		),
		Position: {
			Top: "top",
			Right: "right",
			Bottom: "bottom",
			Left: "left",
		},
		memo: <T extends ComponentType>(component: T) => component,
	};
});

// Mock child components
vi.mock("./icon-indicator", () => ({
	default: ({
		data,
	}: {
		data: { comments?: Array<{ id: number; content: string }> };
	}) => (
		<div
			data-has-comments={data.comments && data.comments.length > 0}
			data-testid="icon-indicator"
		>
			Icon Indicator
		</div>
	),
}));

describe("EvidenceNode", () => {
	// Helper function to create mock props
	const createMockProps = (data: {
		name?: string | null;
		description?: string | null;
		[key: string]: unknown;
	}) => ({
		id: "evidence-1",
		type: "evidence",
		data,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragHandle: undefined,
		dragging: false,
	});
	describe("Basic Rendering", () => {
		it("should render evidence node with basic data", () => {
			const mockProps = {
				id: "evidence-1",
				type: "evidence",
				data: {
					name: "Test Results",
					description: "Automated test suite results showing 99.9% pass rate",
				},
				selected: false,
				zIndex: 0,
				isConnectable: true,
				xPos: 0,
				yPos: 0,
				dragHandle: undefined,
				dragging: false,
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...mockProps} />);

			expect(screen.getByText("Test Results")).toBeInTheDocument();
			expect(
				screen.getByText("Automated test suite results showing 99.9% pass rate")
			).toBeInTheDocument();
		});

		it("should render evidence icon (Database)", () => {
			const mockProps = {
				id: "evidence-1",
				type: "evidence",
				data: {
					name: "Test Evidence",
					description: "Test description",
				},
				selected: false,
				zIndex: 0,
				isConnectable: true,
				xPos: 0,
				yPos: 0,
				dragHandle: undefined,
				dragging: false,
			};

			const { container } = renderWithReactFlowAndAuth(
				<EvidenceNode {...mockProps} />
			);

			// Should have the evidence icon container
			const iconContainers = container.querySelectorAll(".rounded-full");
			// Find the one with the specific classes for icon container
			const iconContainer = Array.from(iconContainers).find(
				(el) => el.classList.contains("w-12") && el.classList.contains("h-12")
			);
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveClass("w-12", "h-12", "bg-emerald-800/30");
		});

		it("should render with emerald background styling", () => {
			const mockProps = {
				id: "evidence-1",
				type: "evidence",
				data: {
					name: "Test Evidence",
					description: "Test description",
				},
				selected: false,
				zIndex: 0,
				isConnectable: true,
				xPos: 0,
				yPos: 0,
				dragHandle: undefined,
				dragging: false,
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...mockProps} />);

			const nodeContainer = screen
				.getByText("Test Evidence")
				.closest(".bg-emerald-600");
			expect(nodeContainer).toHaveClass(
				"bg-emerald-600",
				"text-white",
				"w-[300px]"
			);
		});

		it("should have proper shadow-sm and border radius", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			const nodeContainer = screen
				.getByText("Test Evidence")
				.closest(".shadow-md");
			expect(nodeContainer).toHaveClass("shadow-md", "rounded-md");
		});
	});

	describe("Content Display", () => {
		it("should display evidence name with proper styling", () => {
			const data = {
				name: "Critical Evidence Document",
				description: "Important evidence supporting the claims",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			const nameElement = screen.getByText("Critical Evidence Document");
			expect(nameElement).toHaveClass("text-lg", "font-bold");
		});

		it("should display evidence description", () => {
			const data = {
				name: "Test Evidence",
				description:
					"This is a detailed description of the evidence that supports the property claims and provides verification.",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			const descriptionElement = screen.getByText(
				"This is a detailed description of the evidence that supports the property claims and provides verification."
			);
			expect(descriptionElement).toHaveClass("text-xs", "line-clamp-2");
		});

		it("should handle empty description", () => {
			const data = {
				name: "Test Evidence",
				description: "",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Test Evidence")).toBeInTheDocument();
		});

		it("should handle null description", () => {
			const data = {
				name: "Test Evidence",
				description: null,
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Test Evidence")).toBeInTheDocument();
		});

		it("should truncate long descriptions", () => {
			const data = {
				name: "Test Evidence",
				description:
					"This is a very long description of evidence that should be truncated by the line-clamp-2 class when it exceeds two lines of text content in the evidence node.",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			const descriptionElement = screen.getByText(data.description);
			expect(descriptionElement).toHaveClass("line-clamp-2");
		});
	});

	describe("Child Components", () => {
		it("should render IconIndicator component", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
				comments: [{ id: 1, content: "Test comment" }],
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByTestId("icon-indicator")).toBeInTheDocument();
			expect(screen.getByTestId("icon-indicator")).toHaveAttribute(
				"data-has-comments",
				"true"
			);
		});

		it("should pass data to IconIndicator", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
				comments: [],
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByTestId("icon-indicator")).toHaveAttribute(
				"data-has-comments",
				"false"
			);
		});

		it("should not render ToggleButton (unlike other nodes)", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.queryByTestId("toggle-button")).not.toBeInTheDocument();
		});
	});

	describe("ReactFlow Handles", () => {
		it("should render only top target handle", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByTestId("handle-target")).toBeInTheDocument();
			expect(screen.getByTestId("handle-target")).toHaveAttribute(
				"data-position",
				"top"
			);
		});

		it("should not render source handle (leaf node)", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.queryByTestId("handle-source")).not.toBeInTheDocument();
		});

		it("should only accept incoming connections", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Should have target handle but no source handle
			expect(screen.getByTestId("handle-target")).toBeInTheDocument();
			expect(screen.queryByTestId("handle-source")).not.toBeInTheDocument();
		});
	});

	describe("Layout and Positioning", () => {
		it("should have proper container layout", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Check main container classes
			const mainContainer = screen.getByText("Test Evidence").closest(".px-4");
			expect(mainContainer).toHaveClass("px-4", "py-2", "w-[300px]");
		});

		it("should have proper flex layout for content", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Check inner flex container
			const flexContainer = screen.getByText("Test Evidence").closest(".flex");
			expect(flexContainer).toHaveClass(
				"flex",
				"justify-start",
				"items-center"
			);
		});

		it("should have proper text container width", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Check text container width - go up to the parent container
			const nameElement = screen.getByText("Test Evidence");
			const textContainer = nameElement.parentElement?.parentElement;
			expect(textContainer).toHaveClass("w-[200px]", "ml-2");
		});
	});

	describe("Data Handling", () => {
		it("should handle missing name gracefully", () => {
			const data = {
				name: null,
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Test description")).toBeInTheDocument();
		});

		it("should handle complex evidence data", () => {
			const data = {
				name: "Complex Evidence",
				description: "Complex description",
				URL: "https://example.com/evidence",
				file_path: "/documents/evidence.pdf",
				evidence_type: "document",
				comments: [
					{ id: 1, content: "Comment 1" },
					{ id: 2, content: "Comment 2" },
				],
				metadata: {
					priority: "high",
					status: "verified",
				},
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Complex Evidence")).toBeInTheDocument();
			expect(screen.getByText("Complex description")).toBeInTheDocument();
		});

		it("should handle empty data object", () => {
			const data = {};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Should render without crashing
			expect(screen.getByTestId("icon-indicator")).toBeInTheDocument();
		});

		it("should handle undefined data properties", () => {
			const data = {
				name: "Test Evidence",
				description: undefined,
				comments: undefined,
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Test Evidence")).toBeInTheDocument();
		});
	});

	describe("Styling Differences from Other Nodes", () => {
		it("should use emerald background instead of blue or pink", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			const nodeContainer = screen
				.getByText("Test Evidence")
				.closest(".bg-emerald-600");
			expect(nodeContainer).toHaveClass("bg-emerald-600");
			expect(nodeContainer).not.toHaveClass("bg-blue-600");
			expect(nodeContainer).not.toHaveClass("bg-pink-600");
		});

		it("should use emerald icon background", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			const { container } = renderWithReactFlowAndAuth(
				<EvidenceNode {...createMockProps(data)} />
			);

			// Icon container should have emerald background
			const iconContainers = container.querySelectorAll(".rounded-full");
			// Find the one with the specific classes for icon container
			const iconContainer = Array.from(iconContainers).find(
				(el) => el.classList.contains("w-12") && el.classList.contains("h-12")
			);
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveClass("bg-emerald-800/30");
		});

		it("should use Database icon instead of Goal or FolderOpenDot", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			const { container } = renderWithReactFlowAndAuth(
				<EvidenceNode {...createMockProps(data)} />
			);

			// Icon container should still have the same styling structure
			const iconContainers = container.querySelectorAll(".rounded-full");
			// Find the one with the specific classes for icon container
			const iconContainer = Array.from(iconContainers).find(
				(el) => el.classList.contains("w-12") && el.classList.contains("h-12")
			);
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveClass("w-12", "h-12");
		});
	});

	describe("Accessibility", () => {
		it("should have proper semantic structure", () => {
			const data = {
				name: "Accessible Evidence",
				description: "Evidence with accessibility considerations",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Should have proper heading-like structure
			const nameElement = screen.getByText("Accessible Evidence");
			expect(nameElement).toHaveClass("text-lg", "font-bold");
		});

		it("should have readable color contrast", () => {
			const data = {
				name: "Test Evidence",
				description: "Test description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Should use white text on emerald background
			const nodeContainer = screen
				.getByText("Test Evidence")
				.closest(".bg-emerald-600");
			expect(nodeContainer).toHaveClass("bg-emerald-600", "text-white");
		});

		it("should be a terminal node (no outgoing connections)", () => {
			const data = {
				name: "Terminal Evidence",
				description: "This evidence is a leaf node in the assurance case",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			// Should only have target handle, making it clear this is a terminal node
			expect(screen.getByTestId("handle-target")).toBeInTheDocument();
			expect(screen.queryByTestId("handle-source")).not.toBeInTheDocument();
		});
	});

	describe("Memoization", () => {
		it("should be properly memoized", () => {
			const data = {
				name: "Memoized Evidence",
				description: "This component should be memoized",
			};

			const { rerender } = renderWithReactFlowAndAuth(
				<EvidenceNode {...createMockProps(data)} />
			);

			expect(screen.getByText("Memoized Evidence")).toBeInTheDocument();

			// Re-render with same props should use memoized version
			rerender(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Memoized Evidence")).toBeInTheDocument();
		});

		it("should re-render when data changes", () => {
			const initialData = {
				name: "Initial Evidence",
				description: "Initial description",
			};

			const { rerender } = renderWithReactFlowAndAuth(
				<EvidenceNode {...createMockProps(initialData)} />
			);

			expect(screen.getByText("Initial Evidence")).toBeInTheDocument();

			const updatedData = {
				name: "Updated Evidence",
				description: "Updated description",
			};

			rerender(<EvidenceNode {...createMockProps(updatedData)} />);

			expect(screen.getByText("Updated Evidence")).toBeInTheDocument();
			expect(screen.queryByText("Initial Evidence")).not.toBeInTheDocument();
		});
	});

	describe("Evidence-Specific Features", () => {
		it("should display evidence URLs when present", () => {
			const data = {
				name: "External Evidence",
				description: "Evidence hosted externally",
				URL: "https://example.com/evidence-document.pdf",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("External Evidence")).toBeInTheDocument();
			expect(
				screen.getByText("Evidence hosted externally")
			).toBeInTheDocument();
		});

		it("should handle different evidence types", () => {
			const documentEvidence = {
				name: "Document Evidence",
				description: "PDF document with test results",
				evidence_type: "document",
			};

			renderWithReactFlowAndAuth(
				<EvidenceNode {...createMockProps(documentEvidence)} />
			);

			expect(screen.getByText("Document Evidence")).toBeInTheDocument();
		});

		it("should handle file path evidence", () => {
			const data = {
				name: "Local File Evidence",
				description: "Evidence stored as local file",
				file_path: "/documents/evidence/test-results.pdf",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Local File Evidence")).toBeInTheDocument();
			expect(
				screen.getByText("Evidence stored as local file")
			).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle very long evidence names", () => {
			const data = {
				name: "This is an extremely long evidence name that might cause layout issues if not handled properly in the component",
				description: "Short description",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText(data.name)).toBeInTheDocument();
		});

		it("should handle special characters in evidence name", () => {
			const data = {
				name: "Evidence with Special Characters: !@#$%^&*()_+-=[]{}|;:,.<>?",
				description: "Description with special chars: áéíóú ñ ü",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText(data.name)).toBeInTheDocument();
			expect(screen.getByText(data.description)).toBeInTheDocument();
		});

		it("should handle evidence with attachments", () => {
			const data = {
				name: "Evidence with Attachments",
				description: "Evidence that includes multiple file attachments",
				attachments: [
					{ id: 1, name: "test-results.pdf", size: 1_024_000 },
					{ id: 2, name: "screenshots.zip", size: 2_048_000 },
				],
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Evidence with Attachments")).toBeInTheDocument();
			expect(
				screen.getByText("Evidence that includes multiple file attachments")
			).toBeInTheDocument();
		});

		it("should handle evidence with verification status", () => {
			const data = {
				name: "Verified Evidence",
				description: "Evidence that has been verified",
				verification_status: "verified",
				verified_by: "admin@example.com",
				verified_date: "2024-01-01T00:00:00Z",
			};

			renderWithReactFlowAndAuth(<EvidenceNode {...createMockProps(data)} />);

			expect(screen.getByText("Verified Evidence")).toBeInTheDocument();
			expect(
				screen.getByText("Evidence that has been verified")
			).toBeInTheDocument();
		});
	});
});
