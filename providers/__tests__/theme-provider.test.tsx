import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-themes to control the ThemeProvider behavior
vi.mock("next-themes", () => ({
	ThemeProvider: vi.fn(({ children, ...props }) => (
		<div data-props={JSON.stringify(props)} data-testid="next-themes-provider">
			{children}
		</div>
	)),
}));

// Import after mocking
const { ThemeProvider } = await import("../theme-provider");

describe("ThemeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render children correctly", () => {
			render(
				<ThemeProvider>
					<div data-testid="child-component">Test Child</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("child-component")).toBeInTheDocument();
			expect(screen.getByText("Test Child")).toBeInTheDocument();
		});

		it("should render multiple children", () => {
			render(
				<ThemeProvider>
					<div data-testid="child-1">Child 1</div>
					<div data-testid="child-2">Child 2</div>
					<span data-testid="child-3">Child 3</span>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("child-1")).toBeInTheDocument();
			expect(screen.getByTestId("child-2")).toBeInTheDocument();
			expect(screen.getByTestId("child-3")).toBeInTheDocument();
		});

		it("should render with no children", () => {
			render(<ThemeProvider />);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		});
	});

	describe("Props Forwarding", () => {
		it("should forward all props to NextThemesProvider", () => {
			const props = {
				attribute: "data-theme" as const,
				defaultTheme: "system",
				enableSystem: true,
				themes: ["light", "dark", "system"],
				storageKey: "theme",
			};

			render(
				<ThemeProvider {...props}>
					<div>Test Content</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");

			expect(propsData).toMatchObject(props);
		});

		it("should forward attribute prop", () => {
			render(
				<ThemeProvider attribute="class">
					<div>Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.attribute).toBe("class");
		});

		it("should forward defaultTheme prop", () => {
			render(
				<ThemeProvider defaultTheme="dark">
					<div>Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.defaultTheme).toBe("dark");
		});

		it("should forward enableSystem prop", () => {
			render(
				<ThemeProvider enableSystem={false}>
					<div>Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.enableSystem).toBe(false);
		});

		it("should forward themes array", () => {
			const themes = ["light", "dark", "blue", "red"];

			render(
				<ThemeProvider themes={themes}>
					<div>Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.themes).toEqual(themes);
		});

		it("should forward storageKey prop", () => {
			render(
				<ThemeProvider storageKey="custom-theme">
					<div>Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.storageKey).toBe("custom-theme");
		});
	});

	describe("Props Combinations", () => {
		it("should handle all props together", () => {
			const allProps = {
				attribute: "data-theme" as const,
				defaultTheme: "system",
				enableSystem: true,
				themes: ["light", "dark", "system"],
				storageKey: "app-theme",
			};

			render(
				<ThemeProvider {...allProps}>
					<div>All Props Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData).toMatchObject(allProps);
		});

		it("should work with minimal props", () => {
			render(
				<ThemeProvider>
					<div>Minimal Props Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByText("Minimal Props Test")).toBeInTheDocument();
		});
	});

	describe("Re-rendering and Updates", () => {
		it("should handle prop updates", () => {
			const { rerender } = render(
				<ThemeProvider defaultTheme="light">
					<div>Theme Test</div>
				</ThemeProvider>
			);

			let provider = screen.getByTestId("next-themes-provider");
			let propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.defaultTheme).toBe("light");

			rerender(
				<ThemeProvider defaultTheme="dark">
					<div>Theme Test</div>
				</ThemeProvider>
			);

			provider = screen.getByTestId("next-themes-provider");
			propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.defaultTheme).toBe("dark");
		});

		it("should handle children updates", () => {
			const { rerender } = render(
				<ThemeProvider>
					<div data-testid="content">Original Content</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("content")).toBeInTheDocument();
			expect(screen.getByText("Original Content")).toBeInTheDocument();

			rerender(
				<ThemeProvider>
					<div data-testid="content">Updated Content</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("content")).toBeInTheDocument();
			expect(screen.getByText("Updated Content")).toBeInTheDocument();
		});
	});

	describe("Provider Nesting", () => {
		it("should work when nested inside other providers", () => {
			const OuterProvider = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="outer-provider">{children}</div>
			);

			render(
				<OuterProvider>
					<ThemeProvider>
						<div data-testid="nested-content">Nested Content</div>
					</ThemeProvider>
				</OuterProvider>
			);

			expect(screen.getByTestId("outer-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("nested-content")).toBeInTheDocument();
		});

		it("should work when wrapping other providers", () => {
			const InnerProvider = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="inner-provider">{children}</div>
			);

			render(
				<ThemeProvider>
					<InnerProvider>
						<div data-testid="deeply-nested">Deeply Nested</div>
					</InnerProvider>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("inner-provider")).toBeInTheDocument();
			expect(screen.getByTestId("deeply-nested")).toBeInTheDocument();
		});
	});

	describe("Performance and Memory", () => {
		it("should handle unmounting gracefully", () => {
			const { unmount } = render(
				<ThemeProvider>
					<div>Unmount Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();

			// Should not throw on unmount
			expect(() => unmount()).not.toThrow();
		});

		it("should handle multiple mount/unmount cycles", () => {
			for (let i = 0; i < 5; i++) {
				const { unmount } = render(
					<ThemeProvider defaultTheme="light">
						<div>Cycle {i}</div>
					</ThemeProvider>
				);

				expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
				unmount();
			}

			// Should not cause memory leaks or issues
			expect(true).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty themes array", () => {
			render(
				<ThemeProvider themes={[]}>
					<div>Empty Themes Test</div>
				</ThemeProvider>
			);

			const provider = screen.getByTestId("next-themes-provider");
			const propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.themes).toEqual([]);
		});

		it("should handle null/undefined props", () => {
			render(
				<ThemeProvider defaultTheme={undefined} themes={undefined}>
					<div>Null Props Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByText("Null Props Test")).toBeInTheDocument();
		});

		it("should handle React strict mode", () => {
			// Simulate React strict mode by rendering twice
			const { unmount } = render(
				<ThemeProvider>
					<div>Strict Mode Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			unmount();

			// Re-render (simulating strict mode remount)
			render(
				<ThemeProvider>
					<div>Strict Mode Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		});
	});

	describe("TypeScript Type Safety", () => {
		it("should accept valid NextThemesProvider props", () => {
			const validProps = {
				attribute: "class" as const,
				defaultTheme: "system",
				enableSystem: true,
				themes: ["light", "dark"],
				storageKey: "theme",
			};

			render(
				<ThemeProvider {...validProps}>
					<div>Type Safety Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		});

		it("should work with generic children types", () => {
			const ComponentWithChildren = ({
				children,
			}: {
				children: React.ReactNode;
			}) => <div>{children}</div>;

			render(
				<ThemeProvider>
					<ComponentWithChildren>
						<span>Generic Children Test</span>
					</ComponentWithChildren>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		});
	});

	describe("Real-world Usage Patterns", () => {
		it("should work in typical app structure", () => {
			const App = () => (
				<ThemeProvider defaultTheme="system" enableSystem>
					<div className="app">
						<header>App Header</header>
						<main>Main Content</main>
						<footer>App Footer</footer>
					</div>
				</ThemeProvider>
			);

			render(<App />);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByText("App Header")).toBeInTheDocument();
			expect(screen.getByText("Main Content")).toBeInTheDocument();
			expect(screen.getByText("App Footer")).toBeInTheDocument();
		});

		it("should handle theme configuration changes", () => {
			const App = ({ isDarkModeOnly }: { isDarkModeOnly: boolean }) => (
				<ThemeProvider
					defaultTheme={isDarkModeOnly ? "dark" : "system"}
					themes={isDarkModeOnly ? ["dark"] : ["light", "dark", "system"]}
				>
					<div>Theme Config App</div>
				</ThemeProvider>
			);

			const { rerender } = render(<App isDarkModeOnly={false} />);

			let provider = screen.getByTestId("next-themes-provider");
			let propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.themes).toEqual(["light", "dark", "system"]);
			expect(propsData.defaultTheme).toBe("system");

			rerender(<App isDarkModeOnly={true} />);

			provider = screen.getByTestId("next-themes-provider");
			propsData = JSON.parse(provider.getAttribute("data-props") || "{}");
			expect(propsData.themes).toEqual(["dark"]);
			expect(propsData.defaultTheme).toBe("dark");
		});
	});
});
