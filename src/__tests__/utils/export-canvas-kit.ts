import type { saveAs } from "file-saver";
import type { toPng } from "html-to-image";
import type { Node } from "reactflow";
import { describe, expect, it, vi } from "vitest";

/** The stroke and width the export gives every edge line while the picture is taken. */
const EXPORT_LINE = ["#666666", "2"];

const UI_CLASSES = [
	"react-flow__minimap",
	"react-flow__controls",
	"react-flow__panel",
	"react-flow__attribution",
];

const KEPT_ELEMENTS: [string, () => HTMLElement][] = [
	["a node", () => elementWithClass("react-flow__node")],
	["an edge", () => elementWithClass("react-flow__edge")],
	["a text node", () => document.createTextNode("x") as unknown as HTMLElement],
];

const UI_ATTRIBUTES = ["data-plugin-display", "data-derived-display"];

type CaptureFilter = (node: HTMLElement) => boolean;

function elementWithClass(name: string): HTMLElement {
	const el = document.createElement("div");
	el.classList.add(name);
	return el;
}

/** A canvas block of known size; the name defaults to the id. */
export function canvasBlock(
	id: string,
	options: {
		name?: string;
		x?: number;
		y?: number;
		width?: number;
		height?: number;
	} = {}
): Node {
	return {
		id,
		type: "property",
		position: { x: options.x ?? 0, y: options.y ?? 0 },
		width: options.width ?? 100,
		height: options.height ?? 100,
		data: { name: options.name ?? id },
	};
}

/** Puts a canvas viewport holding one coloured and one bare edge line in the page. */
export function putCanvasInPage(): void {
	document.body.innerHTML = `<div class="react-flow__viewport"><svg>
		<path id="coloured" class="react-flow__edge-path" stroke="teal" stroke-width="7" d="M0"></path>
		<path id="bare" class="react-flow__edge-path" d="M1"></path>
	</svg></div>`;
}

export function viewportElement(): Element {
	return document.querySelector(".react-flow__viewport")!;
}

/** Fakes the clock the export waits on, leaving the rest of the runtime real. */
export function useExportClock(): void {
	vi.useFakeTimers({
		toFake: [
			"Date",
			"setTimeout",
			"clearTimeout",
			"requestAnimationFrame",
			"cancelAnimationFrame",
		],
	});
}

/** Lets the export's waits run on the fake clock, then reports how it ended. */
export async function settle<T>(
	promise: Promise<T>
): Promise<PromiseSettledResult<T>> {
	let outcome: PromiseSettledResult<T> | undefined;
	promise.then(
		(value) => {
			outcome = { status: "fulfilled", value };
		},
		(reason) => {
			outcome = { status: "rejected", reason };
		}
	);
	for (let i = 0; i < 200 && !outcome; i++) {
		await vi.advanceTimersByTimeAsync(100);
		await new Promise((resolve) => setImmediate(resolve));
	}
	return outcome!;
}

/** Runs the promise on the fake clock and fails the test when it does not succeed. */
export async function completed<T>(promise: Promise<T>): Promise<T> {
	const outcome = await settle(promise);
	if (outcome.status !== "fulfilled") {
		throw new Error("the export was expected to succeed", {
			cause: outcome.status === "rejected" ? outcome.reason : "never finished",
		});
	}
	return outcome.value;
}

/** The error a promise ends with; fails the test when it succeeds. */
export async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
	return await promise.then(
		() => {
			throw new Error("the export was expected to fail");
		},
		(reason) => reason as Error
	);
}

function positionOf(nodes: Node[], id: string) {
	return nodes.find((n) => n.id === id)!.position;
}

/** Horizontal distance from one sibling to the next. */
export function sideGap(nodes: Node[], left: string, right: string): number {
	return positionOf(nodes, right).x - positionOf(nodes, left).x;
}

/** Vertical distance from a parent to its child. */
export function layerGap(nodes: Node[], parent: string, child: string): number {
	return positionOf(nodes, child).y - positionOf(nodes, parent).y;
}

/** Registers the checks on the filter an export gives the drawing package. */
export function describeCaptureFilter(
	capture: () => Promise<CaptureFilter>
): void {
	describe("the filter given to the drawing package", () => {
		it.each(UI_CLASSES)("leaves out an element with class %s", async (name) => {
			const filter = await capture();

			expect(filter(elementWithClass(name))).toBe(false);
		});

		it.each(KEPT_ELEMENTS)("keeps %s", async (_label, make) => {
			const filter = await capture();

			expect(filter(make())).toBe(true);
		});

		it.each(
			UI_ATTRIBUTES
		)("leaves out an element marked %s", async (attribute) => {
			const filter = await capture();
			const el = document.createElement("div");
			el.setAttribute(attribute, "");

			expect(filter(el)).toBe(false);
		});
	});
}

function lineOf(id: string): Array<string | null> {
	const path = document.getElementById(id)!;
	return [path.getAttribute("stroke"), path.getAttribute("stroke-width")];
}

/** The lines the page's two edge paths were given before any export. */
const ORIGINAL_LINES = [
	["teal", "7"],
	[null, null],
];

function currentLines(): Array<Array<string | null>> {
	return [lineOf("coloured"), lineOf("bare")];
}

interface EdgeLineChecks {
	/** Runs a whole export and returns the error it ends with. */
	exportFailure: () => Promise<Error>;
	/** Runs a whole export that is expected to succeed. */
	exportPicture: () => Promise<unknown>;
	pictureUrl: string;
	saveAs: ReturnType<typeof vi.mocked<typeof saveAs>>;
	toPng: ReturnType<typeof vi.mocked<typeof toPng>>;
}

/** Registers the checks on the edge lines while the picture is taken. */
export function describeEdgeLines(checks: EdgeLineChecks): void {
	describe("the edge lines while the picture is taken", () => {
		it("sets the export lines for the picture and puts the originals back", async () => {
			const seen: Array<Array<string | null>> = [];
			checks.toPng.mockImplementationOnce(() => {
				seen.push(lineOf("coloured"), lineOf("bare"));
				return Promise.resolve(checks.pictureUrl);
			});

			await checks.exportPicture();

			expect(seen).toStrictEqual([EXPORT_LINE, EXPORT_LINE]);
			expect(currentLines()).toStrictEqual(ORIGINAL_LINES);
		});

		it("puts the originals back and passes the error on when the picture fails", async () => {
			checks.toPng.mockReset();
			checks.toPng.mockRejectedValue(new Error("no picture"));

			const failure = await checks.exportFailure();

			expect(failure.message).toBe("no picture");
			expect(currentLines()).toStrictEqual(ORIGINAL_LINES);
			expect(checks.saveAs).not.toHaveBeenCalled();
		});
	});
}
