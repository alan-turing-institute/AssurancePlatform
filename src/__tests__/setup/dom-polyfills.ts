import { vi } from "vitest";

// ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// window.matchMedia
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

// window.getComputedStyle (for axe-core)
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = vi
	.fn()
	.mockImplementation((element: Element, pseudoElt?: string | null) => {
		if (pseudoElt) {
			return {
				getPropertyValue: () => "",
				length: 0,
			};
		}
		return originalGetComputedStyle(element);
	});

// Pointer event methods
if (!HTMLElement.prototype.hasPointerCapture) {
	HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
}

if (!HTMLElement.prototype.setPointerCapture) {
	HTMLElement.prototype.setPointerCapture = vi.fn();
}

if (!HTMLElement.prototype.releasePointerCapture) {
	HTMLElement.prototype.releasePointerCapture = vi.fn();
}

// scrollIntoView
if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = vi.fn();
}

// HTMLDialogElement methods
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

// HTMLFormElement.requestSubmit
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

		if (this.method === "dialog") {
			const dialog = this.closest("dialog");
			if (dialog && typeof dialog.close === "function") {
				dialog.close();
			}
		}
	};
}

// DragEvent polyfill
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

// Canvas context mock (for ReactFlow)
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
