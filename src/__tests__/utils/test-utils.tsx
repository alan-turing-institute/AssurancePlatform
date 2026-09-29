import { type RenderOptions, render } from "@testing-library/react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type React from "react";
import type { ReactElement } from "react";
import { ReactFlowProvider } from "reactflow";
import { ModalProvider } from "@/providers/modal-provider";
import { ThemeProvider } from "@/providers/theme-provider";

// Provider wrapper for tests
interface ProvidersProps {
	children: React.ReactNode;
	session?: Session | null;
}

const Providers = ({ children, session = null }: ProvidersProps) => (
	<SessionProvider session={session}>
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			{children}
			<ModalProvider />
		</ThemeProvider>
	</SessionProvider>
);

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
	session?: Session | null;
	withProviders?: boolean;
}

const customRender = (ui: ReactElement, options: CustomRenderOptions = {}) => {
	const { session = null, withProviders = true, ...renderOptions } = options;

	if (!withProviders) {
		return render(ui, renderOptions);
	}

	return render(ui, {
		wrapper: ({ children }) => (
			<Providers session={session}>{children}</Providers>
		),
		...renderOptions,
	});
};

// Custom render without any providers (for testing components in isolation)
const renderWithoutProviders = (ui: ReactElement, options?: RenderOptions) =>
	render(ui, options);

// Custom render with ReactFlow provider
const renderWithReactFlow = (
	ui: ReactElement,
	options: CustomRenderOptions = {}
) => {
	const { session = null, ...renderOptions } = options;

	return render(ui, {
		wrapper: ({ children }) => (
			<Providers session={session}>
				<ReactFlowProvider>{children}</ReactFlowProvider>
			</Providers>
		),
		...renderOptions,
	});
};

// Helper to wait for async operations
export const waitFor = (callback: () => void | Promise<void>, timeout = 1000) =>
	new Promise((resolve, reject) => {
		const startTime = Date.now();
		const check = async () => {
			try {
				await callback();
				resolve(true);
			} catch (error) {
				if (Date.now() - startTime >= timeout) {
					reject(error);
				} else {
					setTimeout(check, 10);
				}
			}
		};
		check();
	});

// Re-export everything from React Testing Library
export * from "@testing-library/react";

// Re-export userEvent
export { default as userEvent } from "@testing-library/user-event";

// Export custom render functions
export { customRender as render, renderWithoutProviders, renderWithReactFlow };
