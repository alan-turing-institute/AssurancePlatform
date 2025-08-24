import {
	type RenderResult,
	waitFor as rtlWaitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import type { Session } from "next-auth";
import type React from "react";
import { expect, vi } from "vitest";
import {
	mockRouter,
	mockUseRouter,
	mockUseSearchParams,
} from "../mocks/next-navigation-mocks";
import { server } from "../mocks/server";
import { render, renderWithAuth } from "./test-utils";

// Re-export mock router and search params for backward compatibility
export { mockRouter };
export const mockSearchParams = new URLSearchParams();

// Regex constants for form field matching
const EMAIL_REGEX = /email/i;
const PASSWORD_REGEX = /password/i;
const NAME_REGEX = /name/i;
const CONFIRM_PASSWORD_REGEX = /confirm password/i;
const SIGN_IN_REGEX = /sign in/i;
const SIGN_UP_REGEX = /sign up/i;

// Setup navigation mocks
export const setupNavigationMocks = () => {
	mockUseRouter.mockReturnValue(mockRouter);
	mockUseSearchParams.mockReturnValue(mockSearchParams);
};

// Helper for multi-page navigation flows
export class NavigationFlow {
	private currentPath = "/";
	private history: string[] = [];

	constructor(initialPath = "/") {
		this.currentPath = initialPath;
		this.history.push(initialPath);
	}

	async navigateTo(path: string) {
		this.history.push(path);
		this.currentPath = path;
		mockRouter.push(path);

		// Simulate navigation delay
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	async goBack() {
		if (this.history.length > 1) {
			this.history.pop();
			this.currentPath = this.history.at(-1) || "/";
			mockRouter.back();
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	getCurrentPath() {
		return this.currentPath;
	}

	getHistory() {
		return [...this.history];
	}

	reset() {
		this.currentPath = "/";
		this.history = ["/"];
		vi.clearAllMocks();
	}
}

// Helper for complete auth flows
export class AuthFlow {
	private session: Session | null = null;
	private user = userEvent.setup();

	async login(email: string, password: string, component: React.ReactElement) {
		const { getByLabelText, getByRole } = render(component);

		// Fill in login form
		const emailInput = getByLabelText(EMAIL_REGEX);
		const passwordInput = getByLabelText(PASSWORD_REGEX);
		const submitButton = getByRole("button", { name: SIGN_IN_REGEX });

		await this.user.type(emailInput, email);
		await this.user.type(passwordInput, password);
		await this.user.click(submitButton);

		// Wait for authentication to complete
		await rtlWaitFor(() => {
			expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
		});

		// Update session
		this.session = {
			user: {
				email,
				name: "Test User",
				image: null,
			},
			expires: "2025-12-31",
		} as Session;

		return this.session;
	}

	logout() {
		// Simulate logout API call
		server.use(
			http.post("/api/auth/logout", () => {
				return new Response(null, { status: 200 });
			})
		);

		this.session = null;
		mockRouter.push("/login");
	}

	async register(
		email: string,
		password: string,
		name: string,
		component: React.ReactElement
	) {
		const { getByLabelText, getByRole } = render(component);

		// Fill in registration form
		const nameInput = getByLabelText(NAME_REGEX);
		const emailInput = getByLabelText(EMAIL_REGEX);
		const passwordInput = getByLabelText(PASSWORD_REGEX);
		const confirmPasswordInput = getByLabelText(CONFIRM_PASSWORD_REGEX);
		const submitButton = getByRole("button", { name: SIGN_UP_REGEX });

		await this.user.type(nameInput, name);
		await this.user.type(emailInput, email);
		await this.user.type(passwordInput, password);
		await this.user.type(confirmPasswordInput, password);
		await this.user.click(submitButton);

		// Wait for registration to complete
		await rtlWaitFor(() => {
			expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
		});

		// Update session
		this.session = {
			user: {
				email,
				name,
				image: null,
			},
			expires: "2025-12-31",
		} as Session;

		return this.session;
	}

	getSession() {
		return this.session;
	}

	isAuthenticated() {
		return this.session !== null;
	}
}

// Helper for API state management in tests
export class ApiStateManager {
	private apiResponses: Map<string, unknown> = new Map();
	private apiErrors: Map<string, Error> = new Map();

	setResponse(endpoint: string, response: unknown) {
		this.apiResponses.set(endpoint, response);

		// Setup MSW handler
		server.use(
			http.get(endpoint, () => {
				return Response.json(response);
			})
		);
	}

	setError(
		endpoint: string,
		error: Error | { status: number; message: string }
	) {
		this.apiErrors.set(
			endpoint,
			error instanceof Error ? error : new Error(error.message)
		);

		// Setup MSW handler for error
		server.use(
			http.get(endpoint, () => {
				if ("status" in error) {
					return new Response(JSON.stringify({ message: error.message }), {
						status: error.status,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response(null, { status: 500 });
			})
		);
	}

	clearAll() {
		this.apiResponses.clear();
		this.apiErrors.clear();
		server.resetHandlers();
	}

	getResponse(endpoint: string) {
		return this.apiResponses.get(endpoint);
	}

	hasError(endpoint: string) {
		return this.apiErrors.has(endpoint);
	}
}

// Helper for waiting for async operations with better error messages
export async function waitForAsync(
	callback: () => void | Promise<void>,
	options: {
		timeout?: number;
		interval?: number;
		errorMessage?: string;
	} = {}
) {
	const {
		timeout = 5000,
		interval = 50,
		errorMessage = "Async operation timed out",
	} = options;

	try {
		await rtlWaitFor(callback, { timeout, interval });
	} catch (error) {
		throw new Error(
			`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// Helper for simulating user interactions across pages
export class UserJourney {
	private user = userEvent.setup();
	private navigation: NavigationFlow;
	private auth: AuthFlow;
	private apiState: ApiStateManager;
	private currentRender: RenderResult | null = null;

	constructor() {
		this.navigation = new NavigationFlow();
		this.auth = new AuthFlow();
		this.apiState = new ApiStateManager();
	}

	startAt(
		component: React.ReactElement,
		options?: { authenticated?: boolean }
	) {
		setupNavigationMocks();

		if (options?.authenticated) {
			this.currentRender = renderWithAuth(component);
		} else {
			this.currentRender = render(component);
		}

		return this.currentRender;
	}

	async click(element: Element | string) {
		if (!this.currentRender) {
			throw new Error("No component rendered. Call startAt() first.");
		}

		const target =
			typeof element === "string"
				? this.currentRender.getByRole("button", {
						name: new RegExp(element, "i"),
					})
				: element;

		await this.user.click(target);
	}

	async type(element: Element | string, text: string) {
		if (!this.currentRender) {
			throw new Error("No component rendered. Call startAt() first.");
		}

		const target =
			typeof element === "string"
				? this.currentRender.getByLabelText(new RegExp(element, "i"))
				: element;

		await this.user.type(target, text);
	}

	async select(element: Element | string, value: string) {
		if (!this.currentRender) {
			throw new Error("No component rendered. Call startAt() first.");
		}

		const target =
			typeof element === "string"
				? this.currentRender.getByLabelText(new RegExp(element, "i"))
				: element;

		await this.user.selectOptions(target, value);
	}

	async upload(element: Element | string, file: File) {
		if (!this.currentRender) {
			throw new Error("No component rendered. Call startAt() first.");
		}

		const target =
			typeof element === "string"
				? this.currentRender.getByLabelText(new RegExp(element, "i"))
				: element;

		await this.user.upload(target as HTMLElement, file);
	}

	async waitForElement(testId: string | RegExp) {
		if (!this.currentRender) {
			throw new Error("No component rendered. Call startAt() first.");
		}

		await rtlWaitFor(() => {
			this.currentRender?.getByTestId(testId);
		});
	}

	async waitForText(text: string | RegExp) {
		if (!this.currentRender) {
			throw new Error("No component rendered. Call startAt() first.");
		}

		await rtlWaitFor(() => {
			this.currentRender?.getByText(text);
		});
	}

	getNavigation() {
		return this.navigation;
	}

	getAuth() {
		return this.auth;
	}

	getApiState() {
		return this.apiState;
	}

	cleanup() {
		this.navigation.reset();
		this.apiState.clearAll();
		this.currentRender = null;
		vi.clearAllMocks();
	}
}

// Helper for testing WebSocket connections
export class WebSocketTestHelper {
	private mockSocket: Partial<WebSocket> & {
		send: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
		dispatchEvent: ReturnType<typeof vi.fn>;
	};
	private handlers: Map<
		string,
		(event: Event | MessageEvent | CloseEvent) => void
	> = new Map();

	constructor() {
		this.mockSocket = {
			send: vi.fn(),
			close: vi.fn(),
			addEventListener: vi.fn(
				(
					eventType: string,
					handler: (event: Event | MessageEvent | CloseEvent) => void
				) => {
					this.handlers.set(eventType, handler);
				}
			),
			removeEventListener: vi.fn((event: string) => {
				this.handlers.delete(event);
			}),
			dispatchEvent: vi.fn((event: Event) => {
				const handler = this.handlers.get(event.type);
				if (handler) {
					handler(event);
				}
				return true;
			}),
			readyState: WebSocket.OPEN,
			url: "",
			CONNECTING: 0,
			OPEN: 1,
			CLOSING: 2,
			CLOSED: 3,
			onopen: null,
			onclose: null,
			onerror: null,
			onmessage: null,
			protocol: "",
			extensions: "",
			bufferedAmount: 0,
			binaryType: "blob" as BinaryType,
		};
	}

	simulateMessage(data: unknown) {
		const handler = this.handlers.get("message");
		if (handler) {
			const messageEvent = new MessageEvent("message", {
				data: JSON.stringify(data),
			});
			handler(messageEvent);
		}
	}

	simulateError(error: Error) {
		const handler = this.handlers.get("error");
		if (handler) {
			const errorEvent = new Event("error");
			Object.defineProperty(errorEvent, "error", {
				value: error,
				enumerable: true,
			});
			handler(errorEvent);
		}
	}

	simulateOpen() {
		this.mockSocket.readyState = WebSocket.OPEN;
		const handler = this.handlers.get("open");
		if (handler) {
			const openEvent = new Event("open");
			handler(openEvent);
		}
	}

	simulateClose(code?: number, reason?: string) {
		this.mockSocket.readyState = WebSocket.CLOSED;
		const handler = this.handlers.get("close");
		if (handler) {
			handler(new CloseEvent("close", { code, reason }));
		}
	}

	getMockSocket() {
		return this.mockSocket;
	}

	getSentMessages() {
		return this.mockSocket.send.mock.calls.map((call: unknown[]) => {
			try {
				return JSON.parse(call[0]);
			} catch {
				return call[0]; // Return raw if not JSON
			}
		});
	}

	// Helper method to get the number of messages sent
	getSentMessageCount() {
		return this.mockSocket.send.mock.calls.length;
	}

	// Helper method to clear sent messages for test isolation
	clearSentMessages() {
		this.mockSocket.send.mockClear();
	}
}

// Export a pre-configured test environment
export function createIntegrationTestEnvironment() {
	const journey = new UserJourney();

	return {
		journey,
		navigation: journey.getNavigation(),
		auth: journey.getAuth(),
		api: journey.getApiState(),
		cleanup: () => journey.cleanup(),
	};
}
