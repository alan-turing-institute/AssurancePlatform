import "@testing-library/jest-dom";
import {
	toBeInTheDocument,
	toHaveAttribute,
	toHaveClass,
	toHaveTextContent,
} from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import type React from "react";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
import { server } from "./mocks/server";

const matchers = {
	toBeInTheDocument,
	toHaveAttribute,
	toHaveClass,
	toHaveTextContent,
};

// Set up environment variables for tests
// Note: Removed global env var setting to allow individual tests to control their environment
// process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Setup MSW
beforeAll(() => {
	server.listen({ onUnhandledRequest: "warn" });

	// Set up a base URL for relative fetch requests
	const url = new URL("http://localhost:3000");
	const mockLocation = {
		href: url.href,
		origin: url.origin,
		protocol: url.protocol,
		host: url.host,
		hostname: url.hostname,
		port: url.port,
		pathname: url.pathname,
		search: url.search,
		hash: url.hash,
		reload: vi.fn(),
		replace: vi.fn(),
		assign: vi.fn(),
		toString: () => url.toString(),
	};

	Object.defineProperty(window, "location", {
		value: mockLocation,
		writable: true,
		configurable: true,
	});
});

afterEach(() => {
	server.resetHandlers();
	cleanup();
});

afterAll(() => {
	server.close();
});

// Mock Next.js router
import {
	mockNotFound,
	mockUseParams,
	mockUsePathname,
	mockUseRouter,
	mockUseSearchParams,
} from "./mocks/next-navigation-mocks";

vi.mock("next/navigation", () => ({
	useRouter: mockUseRouter,
	usePathname: mockUsePathname,
	useSearchParams: mockUseSearchParams,
	useParams: mockUseParams,
	notFound: mockNotFound,
}));

// Mock Next.js image component
vi.mock("next/image", () => ({
	default: (props: {
		fill?: boolean;
		priority?: boolean;
		quality?: number;
		placeholder?: string;
		blurDataURL?: string;
		[key: string]: unknown;
	}) => {
		// Filter out Next.js specific props that aren't valid for HTML img element
		const {
			fill: _fill,
			priority: _priority,
			quality: _quality,
			placeholder: _placeholder,
			blurDataURL: _blurDataURL,
			...imgProps
		} = props;
		// eslint-disable-next-line @next/next/no-img-element
		// biome-ignore lint/performance/noImgElement: This is a test mock for Next.js Image component
		return <img alt="" {...imgProps} />;
	},
}));

// Mock next-themes
vi.mock("next-themes", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
	useTheme: () => ({
		theme: "light",
		setTheme: vi.fn(),
		resolvedTheme: "light",
		themes: ["light", "dark", "system"],
		systemTheme: "light",
	}),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: {
			user: {
				id: "1",
				name: "Test User",
				email: "test@example.com",
			},
			key: "mock-jwt-token",
			expires: "2025-12-31",
		},
		status: "authenticated",
	}),
	signIn: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock ReactFlow with proper provider setup
const mockReactFlowStore = {
	getState: vi.fn(() => ({
		nodes: [],
		edges: [],
		nodeInternals: new Map(),
		onNodesChange: vi.fn(),
		onEdgesChange: vi.fn(),
		onConnect: vi.fn(),
		fitView: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		setNodes: vi.fn(),
		setEdges: vi.fn(),
		addNodes: vi.fn(),
		addEdges: vi.fn(),
		getNode: vi.fn(),
		getNodes: vi.fn(() => []),
		getEdges: vi.fn(() => []),
	})),
	setState: vi.fn(),
	subscribe: vi.fn(() => vi.fn()),
	destroy: vi.fn(),
};

vi.mock("reactflow", () => {
	const ReactLib = require("react");
	return {
		default: ({
			children,
			...props
		}: {
			children?: React.ReactNode;
			[key: string]: unknown;
		}) => {
			const MockReactFlowProvider = ({
				children: providerChildren,
			}: {
				children: React.ReactNode;
			}) =>
				ReactLib.createElement(
					"div",
					{ "data-testid": "react-flow-provider" },
					providerChildren
				);
			return ReactLib.createElement(
				MockReactFlowProvider,
				{},
				ReactLib.createElement(
					"div",
					{ "data-testid": "react-flow", ...props },
					children
				)
			);
		},
		ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
			ReactLib.createElement(
				"div",
				{ "data-testid": "react-flow-provider" },
				children
			),
		MiniMap: () =>
			ReactLib.createElement("div", {
				"data-testid": "react-flow-minimap",
			}),
		Controls: () =>
			ReactLib.createElement("div", {
				"data-testid": "react-flow-controls",
			}),
		Background: () =>
			ReactLib.createElement("div", {
				"data-testid": "react-flow-background",
			}),
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNode: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
			setNodes: vi.fn(),
			setEdges: vi.fn(),
			getIntersectingNodes: vi.fn(() => []),
			project: vi.fn((position) => position),
			toObject: vi.fn(() => ({
				nodes: [],
				edges: [],
				viewport: { x: 0, y: 0, zoom: 1 },
			})),
		}),
		useStore: () => mockReactFlowStore.getState(),
		useStoreApi: () => mockReactFlowStore,
		addEdge: vi.fn((params, edges) => [...edges, params]),
		applyNodeChanges: vi.fn((_changes, nodes) => nodes),
		applyEdgeChanges: vi.fn((_changes, edges) => edges),
		useNodesState: () => [[], vi.fn(), vi.fn()],
		useEdgesState: () => [[], vi.fn(), vi.fn()],
		Handle: ({
			type,
			position,
			id,
		}: {
			type: string;
			position: string;
			id?: string;
		}) =>
			ReactLib.createElement("div", {
				"data-testid": `handle-${type}-${position}`,
				"data-id": id,
			}),
		Position: {
			Top: "top",
			Right: "right",
			Bottom: "bottom",
			Left: "left",
		},
		MarkerType: {
			Arrow: "arrow",
			ArrowClosed: "arrowclosed",
		},
	};
});

// Mock toast hook
vi.mock("@/components/ui/use-toast", () => ({
	useToast: () => ({
		toasts: [],
		toast: vi.fn(),
		dismiss: vi.fn(),
	}),
	toast: vi.fn(),
}));

// Note: Store mock removed from global setup to avoid conflicts with test-specific mocks

// Mock all modal hooks to prevent modals from rendering in tests
vi.mock("@/hooks/use-permissions-modal", () => ({
	usePermissionsModal: () => ({
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-case-create-modal", () => ({
	useCaseCreateModal: () => ({
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-import-modal", () => ({
	useImportModal: () => ({
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-share-modal", () => ({
	useShareModal: () => ({
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-email-modal", () => ({
	useEmailModal: () => ({
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-resources-modal", () => ({
	useResourcesModal: () => ({
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	}),
}));

// Mock the entire ModalProvider to prevent modal rendering in tests
vi.mock("@/providers/modal-provider", () => ({
	ModalProvider: () => null,
}));

// Mock Radix UI Dialog components that are causing issues
vi.mock("@radix-ui/react-dialog", async () => {
	const mocks = await import("./mocks/radix-ui-mocks");
	return {
		Root: mocks.MockDialogRoot,
		Trigger: mocks.MockDialogTrigger,
		Portal: mocks.MockDialogPortal,
		Overlay: mocks.MockDialogOverlay,
		Content: mocks.MockDialogContent,
		Close: mocks.MockDialogClose,
		Title: mocks.MockDialogTitle,
		Description: mocks.MockDialogDescription,
		Dialog: mocks.MockDialogRoot,
		DialogTrigger: mocks.MockDialogTrigger,
		DialogPortal: mocks.MockDialogPortal,
		DialogOverlay: mocks.MockDialogOverlay,
		DialogContent: mocks.MockDialogContent,
		DialogClose: mocks.MockDialogClose,
		DialogTitle: mocks.MockDialogTitle,
		DialogDescription: mocks.MockDialogDescription,
	};
});

// Mock Radix UI Tooltip to remove delays in tests
vi.mock("@radix-ui/react-tooltip", async () => {
	const mocks = await import("./mocks/radix-ui-mocks");
	return {
		Root: mocks.MockTooltipRoot,
		Trigger: mocks.MockTooltipTrigger,
		Portal: ({ children }: { children: React.ReactNode }) => children,
		Content: mocks.MockTooltipContent,
		Arrow: mocks.MockTooltipArrow,
		Provider: mocks.MockTooltipProvider,
	};
});

// Mock Radix UI Popover to remove delays in tests
vi.mock("@radix-ui/react-popover", async () => {
	const mocks = await import("./mocks/radix-ui-mocks");
	return {
		Root: mocks.MockPopoverRoot,
		Trigger: mocks.MockPopoverTrigger,
		Portal: mocks.MockPopoverPortal,
		Content: mocks.MockPopoverContent,
		Arrow: mocks.MockPopoverArrow,
		Close: mocks.MockPopoverClose,
		Anchor: mocks.MockPopoverAnchor,
	};
});

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock window.getComputedStyle for axe-core
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = vi
	.fn()
	.mockImplementation((element: Element, pseudoElt?: string | null) => {
		// Return empty object for pseudo elements (not supported in jsdom)
		if (pseudoElt) {
			return {
				getPropertyValue: () => "",
				length: 0,
			};
		}
		// Use the original getComputedStyle for regular elements
		return originalGetComputedStyle(element);
	});

// Add missing pointer event methods to HTMLElement prototype
if (!HTMLElement.prototype.hasPointerCapture) {
	HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
}

if (!HTMLElement.prototype.setPointerCapture) {
	HTMLElement.prototype.setPointerCapture = vi.fn();
}

if (!HTMLElement.prototype.releasePointerCapture) {
	HTMLElement.prototype.releasePointerCapture = vi.fn();
}

// Add missing scrollIntoView method
if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = vi.fn();
}

// Add polyfill for HTMLDialogElement methods
if (typeof HTMLDialogElement !== "undefined") {
	HTMLDialogElement.prototype.showModal = vi.fn(function (
		this: HTMLDialogElement
	): void {
		this.open = true;
		this.setAttribute("open", "");
	});
	HTMLDialogElement.prototype.close = vi.fn(function (
		this: HTMLDialogElement
	): void {
		this.open = false;
		this.removeAttribute("open");
	});
}

// Add polyfill for HTMLFormElement.requestSubmit
if (
	typeof HTMLFormElement !== "undefined" &&
	!HTMLFormElement.prototype.requestSubmit
) {
	HTMLFormElement.prototype.requestSubmit = function (submitter?: HTMLElement) {
		const event = new Event("submit", { bubbles: true, cancelable: true });
		Object.defineProperty(event, "submitter", { value: submitter });

		if (!this.dispatchEvent(event)) {
			return;
		}

		// For dialog forms with method="dialog", close the dialog
		if (this.method === "dialog") {
			const dialog = this.closest("dialog");
			if (dialog && typeof dialog.close === "function") {
				dialog.close();
			}
		}
	};
}

// Mock Radix UI RadioGroup components
vi.mock("@radix-ui/react-radio-group", async () => {
	const mocks = await import("./mocks/radix-ui-mocks");
	return {
		Root: mocks.MockRadioGroupRoot,
		Item: mocks.MockRadioGroupItem,
		Indicator: mocks.MockRadioGroupIndicator,
		RadioGroup: mocks.MockRadioGroupRoot,
		RadioGroupItem: mocks.MockRadioGroupItem,
		RadioGroupIndicator: mocks.MockRadioGroupIndicator,
	};
});

// Mock Radix UI DropdownMenu components to prevent focus errors
vi.mock("@radix-ui/react-dropdown-menu", async () => {
	const mocks = await import("./mocks/radix-ui-mocks");
	return {
		Root: mocks.MockDropdownMenuRoot,
		Trigger: mocks.MockDropdownMenuTrigger,
		Portal: mocks.MockDropdownMenuPortal,
		Content: mocks.MockDropdownMenuContent,
		Item: mocks.MockDropdownMenuItem,
		Separator: mocks.MockDropdownMenuSeparator,
		Label: mocks.MockDropdownMenuLabel,
		Group: mocks.MockDropdownMenuGroup,
		Sub: mocks.MockDropdownMenuSub,
		SubTrigger: mocks.MockDropdownMenuSubTrigger,
		SubContent: mocks.MockDropdownMenuSubContent,
		RadioGroup: mocks.MockDropdownMenuRadioGroup,
		RadioItem: mocks.MockDropdownMenuRadioItem,
		CheckboxItem: mocks.MockDropdownMenuCheckboxItem,
		ItemIndicator: mocks.MockDropdownMenuItemIndicator,
		DropdownMenu: mocks.MockDropdownMenuRoot,
		DropdownMenuTrigger: mocks.MockDropdownMenuTrigger,
		DropdownMenuPortal: mocks.MockDropdownMenuPortal,
		DropdownMenuContent: mocks.MockDropdownMenuContent,
		DropdownMenuItem: mocks.MockDropdownMenuItem,
		DropdownMenuSeparator: mocks.MockDropdownMenuSeparator,
		DropdownMenuLabel: mocks.MockDropdownMenuLabel,
		DropdownMenuGroup: mocks.MockDropdownMenuGroup,
		DropdownMenuSub: mocks.MockDropdownMenuSub,
		DropdownMenuSubTrigger: mocks.MockDropdownMenuSubTrigger,
		DropdownMenuSubContent: mocks.MockDropdownMenuSubContent,
		DropdownMenuRadioGroup: mocks.MockDropdownMenuRadioGroup,
		DropdownMenuRadioItem: mocks.MockDropdownMenuRadioItem,
		DropdownMenuCheckboxItem: mocks.MockDropdownMenuCheckboxItem,
		DropdownMenuItemIndicator: mocks.MockDropdownMenuItemIndicator,
	};
});

// Mock Radix UI Menu components (used in some places as alias for DropdownMenu)
vi.mock("@radix-ui/react-menu", async () => {
	const mocks = await import("./mocks/radix-ui-mocks");
	return {
		Root: mocks.MockMenuRoot,
		Trigger: mocks.MockMenuTrigger,
		Portal: mocks.MockMenuPortal,
		Content: mocks.MockMenuContent,
		Item: mocks.MockMenuItem,
		Separator: mocks.MockMenuSeparator,
		Label: mocks.MockMenuLabel,
		Group: mocks.MockMenuGroup,
		Sub: mocks.MockMenuSub,
		SubTrigger: mocks.MockMenuSubTrigger,
		SubContent: mocks.MockMenuSubContent,
		Menu: mocks.MockMenuRoot,
		MenuTrigger: mocks.MockMenuTrigger,
		MenuPortal: mocks.MockMenuPortal,
		MenuContent: mocks.MockMenuContent,
		MenuItem: mocks.MockMenuItem,
		MenuSeparator: mocks.MockMenuSeparator,
		MenuLabel: mocks.MockMenuLabel,
		MenuGroup: mocks.MockMenuGroup,
		MenuSub: mocks.MockMenuSub,
		MenuSubTrigger: mocks.MockMenuSubTrigger,
		MenuSubContent: mocks.MockMenuSubContent,
	};
});

// Add DragEvent polyfill for file testing
if (typeof global.DragEvent === "undefined") {
	interface MockDragEventInit extends EventInit {
		dataTransfer?: DataTransfer | null;
		clientX?: number;
		clientY?: number;
		screenX?: number;
		screenY?: number;
		ctrlKey?: boolean;
		shiftKey?: boolean;
		altKey?: boolean;
		metaKey?: boolean;
	}

	global.DragEvent = class MockDragEvent extends Event {
		dataTransfer: DataTransfer | null;
		clientX: number;
		clientY: number;
		screenX: number;
		screenY: number;
		ctrlKey: boolean;
		shiftKey: boolean;
		altKey: boolean;
		metaKey: boolean;

		constructor(type: string, eventInitDict?: MockDragEventInit) {
			super(type, eventInitDict);
			this.dataTransfer = eventInitDict?.dataTransfer || null;
			this.clientX = eventInitDict?.clientX || 0;
			this.clientY = eventInitDict?.clientY || 0;
			this.screenX = eventInitDict?.screenX || 0;
			this.screenY = eventInitDict?.screenY || 0;
			this.ctrlKey = eventInitDict?.ctrlKey ?? false;
			this.shiftKey = eventInitDict?.shiftKey ?? false;
			this.altKey = eventInitDict?.altKey ?? false;
			this.metaKey = eventInitDict?.metaKey ?? false;
		}
	} as unknown as typeof DragEvent;
}

// Mock canvas context for ReactFlow
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
	value: () => ({
		fillRect: vi.fn(),
		clearRect: vi.fn(),
		getImageData: vi.fn(() => ({
			data: new Array(4),
		})),
		putImageData: vi.fn(),
		createImageData: vi.fn(() => []),
		setTransform: vi.fn(),
		drawImage: vi.fn(),
		save: vi.fn(),
		fillText: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		closePath: vi.fn(),
		stroke: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		rotate: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		measureText: vi.fn(() => ({ width: 0 })),
		transform: vi.fn(),
		rect: vi.fn(),
		clip: vi.fn(),
	}),
	writable: true,
});
