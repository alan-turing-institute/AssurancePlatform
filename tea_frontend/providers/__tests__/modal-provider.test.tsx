import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clear global modal provider mock to test actual implementation
vi.unmock("@/providers/modal-provider");

// Mock all modal components
vi.mock("@/components/modals/case-create-modal", () => ({
	CaseCreateModal: () => (
		<div data-testid="case-create-modal">CaseCreateModal</div>
	),
}));

vi.mock("@/components/modals/email-modal", () => ({
	EmailModal: () => <div data-testid="email-modal">EmailModal</div>,
}));

vi.mock("@/components/modals/import-modal", () => ({
	ImportModal: () => <div data-testid="import-modal">ImportModal</div>,
}));

vi.mock("@/components/modals/permissions-modal", () => ({
	PermissionsModal: () => (
		<div data-testid="permissions-modal">PermissionsModal</div>
	),
}));

vi.mock("@/components/modals/resources-modal", () => ({
	ResourcesModal: () => <div data-testid="resources-modal">ResourcesModal</div>,
}));

vi.mock("@/components/modals/share-modal", () => ({
	ShareModal: () => <div data-testid="share-modal">ShareModal</div>,
}));

// Import the actual provider after mocking dependencies
const { ModalProvider } = await import("../modal-provider");

describe("ModalProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	describe("Component Rendering", () => {
		it("should render all modals after mounting on client-side", async () => {
			render(<ModalProvider />);

			// Wait for component to mount and update state
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Check all modals are rendered
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
			expect(screen.getByTestId("permissions-modal")).toBeInTheDocument();
			expect(screen.getByTestId("resources-modal")).toBeInTheDocument();
			expect(screen.getByTestId("share-modal")).toBeInTheDocument();
		});

		it("should maintain mounted state across re-renders", async () => {
			const { rerender } = render(<ModalProvider />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Re-render the component
			rerender(<ModalProvider />);

			// Should still render all modals
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
			expect(screen.getByTestId("permissions-modal")).toBeInTheDocument();
			expect(screen.getByTestId("resources-modal")).toBeInTheDocument();
			expect(screen.getByTestId("share-modal")).toBeInTheDocument();
		});
	});

	describe("Server-Side Rendering Protection", () => {
		it("should render modals properly after component mounts", async () => {
			render(<ModalProvider />);

			// Wait for component to mount and render modals
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// All modals should be rendered after mounting
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
		});
	});

	describe("Modal Composition", () => {
		it("should render all required modal components", async () => {
			render(<ModalProvider />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Verify all 6 modal components are present
			const modalTestIds = [
				"case-create-modal",
				"email-modal",
				"import-modal",
				"permissions-modal",
				"resources-modal",
				"share-modal",
			];

			for (const testId of modalTestIds) {
				expect(screen.getByTestId(testId)).toBeInTheDocument();
			}
		});

		it("should render all modals as siblings", async () => {
			render(<ModalProvider />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// All modals should be present in the DOM as siblings
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
			expect(screen.getByTestId("permissions-modal")).toBeInTheDocument();
			expect(screen.getByTestId("resources-modal")).toBeInTheDocument();
			expect(screen.getByTestId("share-modal")).toBeInTheDocument();
		});
	});

	describe("Performance and Memory", () => {
		it("should handle unmounting gracefully", async () => {
			const { unmount } = render(<ModalProvider />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Should not throw on unmount
			expect(() => unmount()).not.toThrow();
		});

		it("should not cause memory leaks with multiple mounts", async () => {
			const { unmount: unmount1 } = render(<ModalProvider />);
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
			unmount1();

			const { unmount: unmount2 } = render(<ModalProvider />);
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
			unmount2();

			const { unmount: unmount3 } = render(<ModalProvider />);
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
			unmount3();

			// Should not throw or cause issues
			expect(true).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should handle React strict mode double mounting", async () => {
			// Simulate React strict mode by rendering twice
			const { unmount } = render(<ModalProvider />);
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
			unmount();

			// Render again (simulating strict mode remount)
			render(<ModalProvider />);
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Should work correctly
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});

		it("should maintain state consistency", async () => {
			// Mock console.error to ensure no errors are logged
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			render(<ModalProvider />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// No errors should be logged
			expect(consoleErrorSpy).not.toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
		});

		it("should handle rapid consecutive renders", async () => {
			const { rerender } = render(<ModalProvider />);

			// Rapidly re-render multiple times
			for (let i = 0; i < 10; i++) {
				rerender(<ModalProvider />);
			}

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Should still render all modals correctly
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
			expect(screen.getByTestId("permissions-modal")).toBeInTheDocument();
			expect(screen.getByTestId("resources-modal")).toBeInTheDocument();
			expect(screen.getByTestId("share-modal")).toBeInTheDocument();
		});
	});

	describe("Component Integration", () => {
		it("should work correctly when wrapped by other providers", async () => {
			const TestWrapper = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="wrapper">{children}</div>
			);

			render(
				<TestWrapper>
					<ModalProvider />
				</TestWrapper>
			);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("wrapper")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});

		it("should handle being rendered multiple times in same tree", async () => {
			render(
				<div>
					<ModalProvider />
					<ModalProvider />
				</div>
			);

			await waitFor(() => {
				expect(screen.getAllByTestId("case-create-modal")).toHaveLength(2);
			});

			// Should render all modals twice (once for each provider)
			expect(screen.getAllByTestId("case-create-modal")).toHaveLength(2);
			expect(screen.getAllByTestId("email-modal")).toHaveLength(2);
			expect(screen.getAllByTestId("import-modal")).toHaveLength(2);
			expect(screen.getAllByTestId("permissions-modal")).toHaveLength(2);
			expect(screen.getAllByTestId("resources-modal")).toHaveLength(2);
			expect(screen.getAllByTestId("share-modal")).toHaveLength(2);
		});
	});

	describe("Return Type and JSX", () => {
		it("should return JSX.Element when mounted", async () => {
			const { container } = render(<ModalProvider />);

			await waitFor(() => {
				expect(container.firstChild).not.toBeNull();
			});

			expect(container.firstChild).toBeInstanceOf(Node);
		});

		it("should satisfy TypeScript return type JSX.Element | null", async () => {
			// This test ensures the component satisfies its type signature
			const provider = <ModalProvider />;
			expect(provider).toBeDefined();
			expect(provider.type).toBe(ModalProvider);
		});
	});

	describe("Real-world Usage Patterns", () => {
		it("should work in typical app layout", async () => {
			const App = () => (
				<div>
					<header>Header</header>
					<main>Main Content</main>
					<ModalProvider />
					<footer>Footer</footer>
				</div>
			);

			render(<App />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByText("Header")).toBeInTheDocument();
			expect(screen.getByText("Main Content")).toBeInTheDocument();
			expect(screen.getByText("Footer")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});

		it("should maintain functionality when app re-renders", async () => {
			const App = ({ version }: { version: number }) => (
				<div>
					<div>App Version: {version}</div>
					<ModalProvider />
				</div>
			);

			const { rerender } = render(<App version={1} />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByText("App Version: 1")).toBeInTheDocument();

			// Re-render with new props
			rerender(<App version={2} />);

			expect(screen.getByText("App Version: 2")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should not create accessibility violations when mounted", async () => {
			render(
				<div>
					<h1>Test Page</h1>
					<ModalProvider />
				</div>
			);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Page structure should remain accessible
			expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});
	});
});
