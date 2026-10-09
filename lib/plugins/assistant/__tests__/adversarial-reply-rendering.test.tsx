// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import userEvent from "@testing-library/user-event";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import {
	LINK_LIKE,
	liveParts,
	SAFE_HREF,
} from "@/src/__tests__/utils/live-dom";
import {
	renderWithoutProviders,
	screen,
	waitFor,
	within,
} from "@/src/__tests__/utils/test-utils";
import { AssistantPanel } from "../assistant-panel";

const chat = vi.hoisted(() => ({
	state: {
		messages: [] as unknown[],
		status: "ready",
		error: undefined as Error | undefined,
		sendMessage: vi.fn(),
		stop: vi.fn(),
	},
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat.state }));
vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: { user: { id: "u1" } }, status: "authenticated" }),
}));
vi.mock("@/lib/plugins/assistant/chat-store", () => ({
	getCaseChat: () => ({}),
}));

const CTX = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: undefined,
	selectedElementLabel: undefined,
};

const TOOLS_URL = "/api/cases/case-1/assistant";

const fetchMock = vi.fn((url: string) =>
	Promise.resolve(
		url === TOOLS_URL
			? Response.json({ tools: [] })
			: new Response("not expected", { status: 500 })
	)
);

class QuietObserver {
	observe() {
		// Never reports an intersection, so diagrams stay unrendered.
	}
	unobserve() {
		// Nothing to stop.
	}
	disconnect() {
		// Nothing to stop.
	}
	takeRecords() {
		return [];
	}
}

beforeAll(() => {
	vi.stubGlobal("IntersectionObserver", QuietObserver);
});

let openSpy: MockInstance<Window["open"]>;
let imageSpy: { mock: { calls: unknown[] }; mockRestore: () => void };

beforeEach(() => {
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
	openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
	imageSpy = vi.spyOn(window, "Image");
});

afterEach(() => {
	openSpy.mockRestore();
	imageSpy.mockRestore();
});

type Surface = "reply" | "thinking";
const SURFACES: Surface[] = ["reply", "thinking"];

/** Shows the text as a streamed reply, or as the model's thinking with the block opened. */
async function showModelText(surface: Surface, text: string) {
	chat.state.messages = [
		{
			id: "m",
			role: "assistant",
			parts:
				surface === "reply"
					? [{ type: "text", text }]
					: [
							{ type: "reasoning", text, state: "done" },
							{ type: "text", text: "Done.", state: "done" },
						],
		},
	];
	renderWithoutProviders(<AssistantPanel {...CTX} />);
	if (surface === "thinking") {
		await userEvent.click(
			within(screen.getByTestId("assistant-reasoning")).getByRole("button")
		);
	}
	return screen.getByTestId("assistant-message-assistant");
}

/** Requests the page made other than the tool list: any fetch, and any image created from script. */
function requestsBeyondTheToolList(): string[] {
	const fetched = fetchMock.mock.calls
		.map(([url]) => url)
		.filter((url) => url !== TOOLS_URL);
	return imageSpy.mock.calls.length > 0 ? [...fetched, "new Image()"] : fetched;
}

const RAW_HTML: [string, string, string][] = [
	[
		"an svg with an onload handler",
		"a <svg onload=alert(1)><circle r=1/></svg> b",
		"<svg onload=alert(1)>",
	],
	[
		"an iframe",
		'<iframe src="https://evil.example/frame"></iframe>',
		"<iframe",
	],
	[
		"HTML nested in markdown",
		"**bold** <div><p onclick=alert(1)>x <b>y</b></p></div> _it_",
		"onclick=alert(1)",
	],
	["an img with an onerror handler", "<img src=x onerror=alert(1)>", "onerror"],
	[
		"an img written with a slash separator",
		"<img/src=x onerror=alert(1)>",
		"onerror",
	],
	[
		"a raw anchor with a javascript: target",
		'<a href="javascript:alert(1)">click</a>',
		'<a href="javascript:alert(1)">',
	],
	[
		"a stylesheet import",
		"<style>@import url(https://evil.example/x.css)</style>",
		"@import",
	],
	[
		"a stylesheet link",
		"<link rel=stylesheet href=https://evil.example/x.css>",
		"<link",
	],
	[
		"a meta refresh",
		'<meta http-equiv="refresh" content="0;url=https://evil.example">',
		"<meta",
	],
	["a base element", "<base href=https://evil.example/>", "<base"],
	[
		"a form",
		"<form action=https://evil.example><input name=x></form>",
		"<form",
	],
	["an object", "<object data=https://evil.example/x></object>", "<object"],
	["an embed", "<embed src=https://evil.example/x>", "<embed"],
	[
		"a video",
		"<video src=https://evil.example/x poster=https://evil.example/y></video>",
		"<video",
	],
	["an audio element", "<audio src=https://evil.example/x></audio>", "<audio"],
	[
		"a MathML link",
		"<math><mi xlink:href=javascript:alert(1)>x</mi></math>",
		"<math>",
	],
	["a script", "before <script>alert(1)</script> after", "<script>alert(1)"],
];

const IMAGES: [string, string, string][] = [
	[
		"a markdown image from another origin",
		"![alt text](https://evil.example/x.png)",
		"alt text",
	],
	[
		"a data: image",
		"![inline pic](data:image/png;base64,iVBORw0KGgo=)",
		"inline pic",
	],
	[
		"a data: SVG image with a handler",
		"![svg pic](data:image/svg+xml;utf8,<svg onload=alert(1)>)",
		"svg pic",
	],
	[
		"a reference-style image",
		"![ref pic][1]\n\n[1]: https://evil.example/x.png",
		"ref pic",
	],
	[
		"an image with a title",
		'![titled pic](https://evil.example/x.png "title")',
		"titled pic",
	],
	[
		"an image inside a link",
		"[![linked pic](https://evil.example/x.png)](https://example.com)",
		"linked pic",
	],
	[
		"an image whose address is written with an entity",
		"![entity pic](&#104;ttps://evil.example/x.png)",
		"entity pic",
	],
	[
		"an image still being streamed",
		"before ![partial pic](https://evil.example/x.png",
		"before",
	],
];

const DANGEROUS_LINKS: [string, string][] = [
	["an inline javascript: link", "[x](javascript:alert(1))"],
	["a mixed-case javascript: link", "[x](JaVaScRiPt:alert(1))"],
	["an entity-encoded javascript: link", "[x](&#106;avascript:alert(1))"],
	["a javascript: link with leading space", "[x]( javascript:alert(1))"],
	["a javascript: autolink", "<javascript:alert(1)>"],
	["a reference-style javascript: link", "[x][1]\n\n[1]: javascript:alert(1)"],
	["a shortcut-reference javascript: link", "[x]\n\n[x]: javascript:alert(1)"],
	[
		"a data: HTML link",
		"[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
	],
	["a data: autolink", "<data:text/html,hello>"],
	["a vbscript: link", "[x](vbscript:msgbox(1))"],
	["a javascript: link still being streamed", "[x](javascript:alert(1)"],
];

const KATEX: [string, string][] = [
	["a link command", "$$\\href{javascript:alert(1)}{click}$$"],
	["a url command", "$$\\url{javascript:alert(1)}$$"],
	["an inline link command", "see $$\\href{javascript:alert(1)}{click}$$ here"],
	["a data command", "$$\\htmlData{onclick=alert(1)}{x}$$"],
	["a class command", "$$\\htmlClass{evilclass}{x}$$"],
	["an id command", "$$\\htmlId{evilid}{x}$$"],
	[
		"a style command",
		"$$\\htmlStyle{background:url(https://evil.example/x)}{x}$$",
	],
	["an image command", "$$\\includegraphics{https://evil.example/x.png}$$"],
];

describe.each(SURFACES)("model text in the %s", (surface) => {
	it.each(
		RAW_HTML
	)("shows %s as text and creates no element", async (_name, payload, shown) => {
		const region = await showModelText(surface, payload);

		await waitFor(() => expect(region.textContent).toContain(shown));
		expect(liveParts(region)).toEqual([]);
		expect(requestsBeyondTheToolList()).toEqual([]);
	});

	it.each(
		IMAGES
	)("creates no img element for %s and fetches nothing", async (_name, payload, alt) => {
		const region = await showModelText(surface, payload);

		await waitFor(() => expect(region.textContent).toContain(alt));
		expect(region.querySelectorAll("img")).toHaveLength(0);
		expect(liveParts(region)).toEqual([]);
		expect(requestsBeyondTheToolList()).toEqual([]);
	});

	it("shows an image that is not allowed as its alt text alone", async () => {
		const region = await showModelText(
			surface,
			"before ![the alt text](https://evil.example/x.png) after"
		);

		await waitFor(() => expect(region.textContent).toContain("the alt text"));
		expect(region.textContent).not.toMatch(/blocked|image/i);
	});

	it.each(
		DANGEROUS_LINKS
	)("leaves no live link for %s", async (_name, payload) => {
		const region = await showModelText(surface, `before ${payload} after`);

		await waitFor(() => expect(region.textContent).toContain("before"));
		expect(liveParts(region)).toEqual([]);
		for (const link of region.querySelectorAll(LINK_LIKE)) {
			await userEvent.click(link);
		}
		expect(
			openSpy.mock.calls.filter(([url]) => !SAFE_HREF.test(String(url)))
		).toEqual([]);
	});

	it.each(KATEX)("does not honour %s in a formula", async (_name, payload) => {
		const region = await showModelText(surface, payload);

		await waitFor(() =>
			expect(region.querySelector(".katex, .katex-error")).not.toBeNull()
		);
		expect(liveParts(region)).toEqual([]);
		expect(region.querySelector(LINK_LIKE)).toBeNull();
		expect(
			region.querySelector("[data-onclick], .evilclass, #evilid")
		).toBeNull();
		expect(requestsBeyondTheToolList()).toEqual([]);
	});

	it("adds no active element for a diagram with HTML labels and click handlers", async () => {
		const region = await showModelText(
			surface,
			'```mermaid\ngraph TD\n A["<img src=x onerror=alert(1)> label"]-->B[<b>bold</b>]\n click A call alert(1)\n click B href "javascript:alert(2)"\n```'
		);

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(liveParts(region)).toEqual([]);
		expect(region.querySelector(LINK_LIKE)).toBeNull();
		expect(requestsBeyondTheToolList()).toEqual([]);
	});

	it("opens a link only after the confirmation step", async () => {
		const region = await showModelText(
			surface,
			"See [the docs](https://example.com/docs) now"
		);

		await userEvent.click(await within(region).findByText("the docs"));

		expect(openSpy).not.toHaveBeenCalled();
		expect(document.body).toHaveTextContent("https://example.com/docs");
		await userEvent.click(screen.getByRole("button", { name: "Open link" }));
		expect(openSpy).toHaveBeenCalledTimes(1);
		const [url, target, features] = openSpy.mock.calls[0] as [
			string,
			string,
			string,
		];
		expect(url).toBe("https://example.com/docs");
		expect(target).toBe("_blank");
		expect(features).toMatch(/noreferrer|noopener/);
	});

	it("opens nothing when the confirmation is closed", async () => {
		const region = await showModelText(
			surface,
			"See [the docs](https://example.com/docs) now"
		);

		await userEvent.click(await within(region).findByText("the docs"));
		await userEvent.click(screen.getByTitle("Close"));

		expect(openSpy).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Open link" })).toBeNull();
	});

	it.each([
		["an autolink", "<https://example.com/auto>"],
		["a bare address", "go to https://example.com/bare today"],
		["a reference-style link", "[ref][1]\n\n[1]: https://example.com/ref"],
	])("opens nothing from %s without the confirmation step", async (_name, payload) => {
		const region = await showModelText(surface, payload);

		await waitFor(() => expect(region.textContent).not.toBe(""));
		for (const link of region.querySelectorAll(LINK_LIKE)) {
			await userEvent.click(link);
		}
		expect(openSpy).not.toHaveBeenCalled();
	});

	it("keeps a safe link live next to a dangerous one", async () => {
		const region = await showModelText(
			surface,
			"[good](https://example.com/good) and [bad](javascript:alert(1))"
		);

		await waitFor(() =>
			expect(within(region).getByText("good")).toBeInTheDocument()
		);
		expect(region.querySelectorAll(LINK_LIKE)).toHaveLength(1);
		expect(liveParts(region)).toEqual([]);
	});

	it.each([
		["one very long word", "A".repeat(200_000)],
		["a run of open brackets", "[".repeat(50_000)],
		["a run of angle brackets", "<".repeat(100_000)],
		["a run of unclosed emphasis", "*a ".repeat(20_000)],
		["a run of unclosed links", "[a](".repeat(5000)],
	])("renders %s without hanging or going live", async (_name, payload) => {
		const started = Date.now();

		const region = await showModelText(surface, payload);

		expect(Date.now() - started).toBeLessThan(5000);
		expect(liveParts(region)).toEqual([]);
	});
});

describe("a user's own message", () => {
	it("stays plain text, whatever it contains", () => {
		const payload =
			"<img src=x onerror=alert(1)> **b** [l](javascript:alert(1)) ![i](https://evil.example/x.png)";
		chat.state.messages = [
			{ id: "m", role: "user", parts: [{ type: "text", text: payload }] },
		];

		renderWithoutProviders(<AssistantPanel {...CTX} />);

		const region = screen.getByTestId("assistant-message-user");
		expect(region.textContent).toContain(payload);
		expect(region.querySelectorAll("img, strong, a, button")).toHaveLength(0);
		expect(liveParts(region)).toEqual([]);
	});
});
