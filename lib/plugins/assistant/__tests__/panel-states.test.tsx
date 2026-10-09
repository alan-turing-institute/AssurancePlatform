// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	act,
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

const TOOLS_URL = "/api/cases/case-1/assistant";
const ALL_TOOLS = [
	"read_case",
	"read_element",
	"lint_case",
	"suggest_techniques",
];

const server = { tools: ALL_TOOLS as unknown, status: 200 };
const fetchMock = vi.fn((input: unknown) => {
	if (String(input) !== TOOLS_URL) {
		return Promise.resolve(new Response("unexpected", { status: 500 }));
	}
	return Promise.resolve(
		server.status === 200
			? Response.json({ tools: server.tools })
			: Response.json({ error: "Case not found" }, { status: server.status })
	);
});

const NO_SELECTION = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: undefined,
	selectedElementLabel: undefined,
};
const SELECTED = {
	...NO_SELECTION,
	selectedElementId: "el-1",
	selectedElementLabel: "P1",
};

beforeEach(() => {
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	chat.state.sendMessage.mockReset();
	chat.state.stop.mockReset();
	server.tools = ALL_TOOLS;
	server.status = 200;
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			observe() {
				// Never reports an intersection.
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
	);
});

interface Ctx {
	canEdit: boolean;
	caseId: string;
	selectedElementId?: string;
	selectedElementLabel?: string;
}

/** Renders the panel and lets the tool-list request settle. */
async function renderPanel(ctx: Ctx = NO_SELECTION) {
	const view = renderWithoutProviders(<AssistantPanel {...ctx} />);
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 40));
	});
	return {
		...view,
		again: () => view.rerender(<AssistantPanel {...ctx} />),
	};
}

const text = (value: string, state?: "streaming" | "done") => ({
	type: "text",
	text: value,
	...(state ? { state } : {}),
});
const thinking = (value: string, state?: "streaming" | "done") => ({
	type: "reasoning",
	text: value,
	...(state ? { state } : {}),
});
const tool = (id: string, state: string, extra: object = {}) => ({
	type: "tool-read_case",
	toolCallId: id,
	state,
	input: {},
	...extra,
});
const user = (value: string) => ({
	id: `u-${value}`,
	role: "user",
	parts: [text(value)],
});
const assistant = (...parts: object[]) => ({
	id: "a1",
	role: "assistant",
	parts,
});

function waitingLine() {
	return screen
		.queryAllByRole("status")
		.find((element) => /^Thinking(…|\.\.\.)$/.test(element.textContent ?? ""));
}

describe("the waiting line", () => {
	const SHOWN: [string, string, unknown[]][] = [
		["right after Send, before any reply", "submitted", [user("hi")]],
		[
			"on a second question",
			"submitted",
			[user("hi"), assistant(text("a", "done")), user("again")],
		],
		["with the user's message last", "streaming", [user("hi")]],
		[
			"when the request is sent again with the earlier reply still last",
			"submitted",
			[user("hi"), assistant(text("a", "done"))],
		],
		[
			"after a tool result that followed text with no state",
			"streaming",
			[
				user("hi"),
				assistant(
					text("let me look"),
					tool("t1", "output-available", { output: {} })
				),
			],
		],
		[
			"after a tool result while the model continues",
			"streaming",
			[
				user("hi"),
				assistant(
					{ type: "step-start" },
					tool("t1", "output-available", { output: { a: 1 } })
				),
			],
		],
		[
			"after a tool result that followed finished text",
			"streaming",
			[
				user("hi"),
				assistant(
					text("let me look", "done"),
					tool("t1", "output-available", { output: {} })
				),
			],
		],
		[
			"after a tool failed",
			"streaming",
			[user("hi"), assistant(tool("t1", "output-error", { errorText: "no" }))],
		],
		[
			"with only a step marker so far",
			"streaming",
			[user("hi"), assistant({ type: "step-start" })],
		],
		[
			"while the only thinking so far is empty",
			"streaming",
			[user("hi"), assistant(thinking("", "streaming"))],
		],
		[
			"while the only text so far is blank",
			"streaming",
			[user("hi"), assistant(text("\n ", "streaming"))],
		],
		[
			"while the only text so far is empty",
			"streaming",
			[user("hi"), assistant(text("", "streaming"))],
		],
	];
	const HIDDEN: [string, string, unknown[]][] = [
		[
			"while thinking text streams",
			"streaming",
			[user("hi"), assistant(thinking("let me", "streaming"))],
		],
		[
			"while reply text streams",
			"streaming",
			[user("hi"), assistant(text("The goal", "streaming"))],
		],
		[
			"while reply text streams after finished thinking",
			"streaming",
			[
				user("hi"),
				assistant(thinking("done thinking", "done"), text("The", "streaming")),
			],
		],
		[
			"while a tool is preparing",
			"streaming",
			[user("hi"), assistant(tool("t1", "input-streaming"))],
		],
		[
			"while a tool runs",
			"streaming",
			[user("hi"), assistant(tool("t1", "input-available"))],
		],
		[
			"while the second of two tools runs and the first has finished",
			"streaming",
			[
				user("hi"),
				assistant(
					tool("t1", "output-available", { output: {} }),
					tool("t2", "input-available")
				),
			],
		],
		[
			"while the first of two tools runs and only the second has finished",
			"streaming",
			[
				user("hi"),
				assistant(
					tool("t1", "input-available"),
					tool("t2", "output-available", { output: {} })
				),
			],
		],
		[
			"under a finished reply while the status is still streaming",
			"streaming",
			[user("hi"), assistant(text("All done.", "done"))],
		],
		[
			"under a reply whose parts carry no state",
			"streaming",
			[user("hi"), assistant(text("All done."))],
		],
		[
			"under finished thinking",
			"streaming",
			[user("hi"), assistant(thinking("done thinking", "done"))],
		],
		[
			"under the timeout notice",
			"streaming",
			[user("hi"), assistant({ type: "data-notice", data: "timeout" })],
		],
		[
			"once the reply is complete",
			"ready",
			[user("hi"), assistant(text("All done.", "done"))],
		],
		["when the last question got no reply", "ready", [user("hi")]],
		["after a failed request", "error", [user("hi")]],
	];

	it.each(SHOWN)("is shown %s", async (_name, status, messages) => {
		chat.state.status = status;
		chat.state.messages = messages;

		await renderPanel();

		expect(waitingLine()).toBeDefined();
	});

	it.each(HIDDEN)("is hidden %s", async (_name, status, messages) => {
		chat.state.status = status;
		chat.state.messages = messages;

		await renderPanel();

		expect(waitingLine()).toBeUndefined();
	});

	it("follows a reply from Send, through thinking and a tool, to the answer", async () => {
		const steps: [string, unknown[], boolean][] = [
			["submitted", [user("hi")], true],
			[
				"streaming",
				[user("hi"), assistant(thinking("hmm", "streaming"))],
				false,
			],
			[
				"streaming",
				[
					user("hi"),
					assistant(thinking("hmm", "done"), tool("t1", "input-available")),
				],
				false,
			],
			[
				"streaming",
				[
					user("hi"),
					assistant(
						thinking("hmm", "done"),
						tool("t1", "output-available", { output: {} })
					),
				],
				true,
			],
			[
				"streaming",
				[
					user("hi"),
					assistant(
						thinking("hmm", "done"),
						tool("t1", "output-available", { output: {} }),
						text("The", "streaming")
					),
				],
				false,
			],
			[
				"ready",
				[
					user("hi"),
					assistant(
						thinking("hmm", "done"),
						tool("t1", "output-available", { output: {} }),
						text("The goal.", "done")
					),
				],
				false,
			],
		];
		const [initial] = steps as [[string, unknown[], boolean]];
		chat.state.status = initial[0];
		chat.state.messages = initial[1];
		const { again } = await renderPanel();

		for (const [status, messages, shown] of steps) {
			chat.state.status = status;
			chat.state.messages = messages;
			again();
			expect(waitingLine() !== undefined).toBe(shown);
		}
	});
});

describe("the thinking block", () => {
	it("is shown once, with the text of every non-empty thinking step", async () => {
		chat.state.messages = [
			user("hi"),
			assistant(
				thinking("", "done"),
				thinking("first plan", "done"),
				tool("t1", "output-available", { output: {} }),
				thinking("second plan", "done"),
				text("Answer.", "done")
			),
		];

		await renderPanel();

		const blocks = screen.getAllByTestId("assistant-reasoning");
		expect(blocks).toHaveLength(1);
		const block = blocks[0] as HTMLElement;
		await userEvent.click(within(block).getByRole("button"));
		expect(block).toHaveTextContent("first plan");
		expect(block).toHaveTextContent("second plan");
	});

	it("is not shown when every thinking step is empty", async () => {
		chat.state.messages = [
			user("hi"),
			assistant(
				thinking("", "done"),
				thinking("", "done"),
				text("Answer.", "done")
			),
		];

		await renderPanel();

		expect(screen.getByText("Answer.")).toBeInTheDocument();
		expect(screen.queryByTestId("assistant-reasoning")).toBeNull();
		expect(screen.queryByText(/thought for|thinking/i)).toBeNull();
	});

	it("is not shown when the thinking is only blank space", async () => {
		chat.state.messages = [
			user("hi"),
			assistant(thinking("\n\n ", "done"), text("Answer.", "done")),
		];

		await renderPanel();

		expect(screen.getByText("Answer.")).toBeInTheDocument();
		expect(screen.queryByTestId("assistant-reasoning")).toBeNull();
	});

	it("is not shown while the only thinking is empty, and the waiting line carries the wait", async () => {
		chat.state.status = "streaming";
		chat.state.messages = [user("hi"), assistant(thinking("", "streaming"))];

		await renderPanel();

		expect(screen.queryByTestId("assistant-reasoning")).toBeNull();
		expect(waitingLine()).toBeDefined();
	});

	it("is open while the model is thinking and collapsed once it has finished", async () => {
		chat.state.status = "streaming";
		chat.state.messages = [
			user("hi"),
			assistant(thinking("working it out", "streaming")),
		];
		const { again } = await renderPanel();
		const trigger = () =>
			within(screen.getByTestId("assistant-reasoning")).getByRole("button");

		expect(trigger()).toHaveAttribute("aria-expanded", "true");

		chat.state.status = "ready";
		chat.state.messages = [
			user("hi"),
			assistant(thinking("working it out", "done"), text("Answer.", "done")),
		];
		again();

		await waitFor(
			() => expect(trigger()).toHaveAttribute("aria-expanded", "false"),
			3000
		);
	});
});

describe("the suggested prompts", () => {
	function chips() {
		const list = screen.queryByTestId("assistant-suggestions");
		return list
			? within(list)
					.getAllByRole("button")
					.map((button) => button.textContent ?? "")
			: [];
	}
	const intro = () => screen.getByTestId("assistant-intro").textContent ?? "";
	const TECHNIQUES = /techni/i;
	const RULES = /rules|lint|check/i;

	it("asks the server for the tool list of this case", async () => {
		await renderPanel();

		expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
			TOOLS_URL,
		]);
	});

	it("offers prompts for every capability when an element is selected", async () => {
		await renderPanel(SELECTED);

		const shown = chips();
		expect(shown.length).toBeGreaterThanOrEqual(3);
		expect(
			shown.some((chip) => TECHNIQUES.test(chip) && chip.includes("P1"))
		).toBe(true);
		expect(shown.some((chip) => RULES.test(chip))).toBe(true);
		expect(
			shown.some((chip) => chip.includes("P1") && !TECHNIQUES.test(chip))
		).toBe(true);
		expect(intro()).toMatch(TECHNIQUES);
	});

	it("offers case-level prompts and no technique prompt when nothing is selected", async () => {
		await renderPanel(NO_SELECTION);

		const shown = chips();
		expect(shown.length).toBeGreaterThanOrEqual(2);
		expect(shown.some((chip) => RULES.test(chip))).toBe(true);
		expect(shown.some((chip) => TECHNIQUES.test(chip))).toBe(false);
		expect(shown.some((chip) => chip.includes("P1"))).toBe(false);
	});

	it("never mentions techniques, in a prompt or in the introduction, without suggest_techniques", async () => {
		server.tools = ["read_case", "read_element", "lint_case"];

		await renderPanel(SELECTED);

		expect(chips().length).toBeGreaterThan(0);
		expect(chips().some((chip) => TECHNIQUES.test(chip))).toBe(false);
		expect(intro()).not.toMatch(TECHNIQUES);
	});

	it("offers only the rules prompt when lint_case is the only tool", async () => {
		server.tools = ["lint_case"];

		await renderPanel(SELECTED);

		const shown = chips();
		expect(shown).toHaveLength(1);
		expect(shown[0]).toMatch(RULES);
	});

	it("offers no rules prompt without lint_case", async () => {
		server.tools = ["read_case", "read_element"];

		await renderPanel(SELECTED);

		expect(chips().length).toBeGreaterThan(0);
		expect(chips().some((chip) => RULES.test(chip))).toBe(false);
	});

	it("offers no technique prompt with nothing selected, even with suggest_techniques", async () => {
		server.tools = ["suggest_techniques"];

		await renderPanel(NO_SELECTION);

		expect(chips()).toEqual([]);
		expect(intro()).toMatch(TECHNIQUES);
	});

	it("offers nothing for a tool name it does not know", async () => {
		server.tools = ["delete_case", "export_everything"];

		await renderPanel(SELECTED);

		expect(chips()).toEqual([]);
		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
	});

	it.each([
		[
			"an empty tool list",
			() => {
				server.tools = [];
			},
		],
		[
			"a tool list that is not a list",
			() => {
				server.tools = "read_case";
			},
		],
		[
			"a refused request",
			() => {
				server.status = 404;
			},
		],
	])("shows the introduction and no prompts for %s", async (_name, arrange) => {
		arrange();

		await renderPanel(SELECTED);

		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(chips()).toEqual([]);
		expect(screen.getByLabelText("Message the assistant")).toBeEnabled();
	});

	it("shows the introduction and no prompts when the request cannot be made", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("network down"));

		await renderPanel(SELECTED);

		expect(screen.getByTestId("assistant-intro")).toBeInTheDocument();
		expect(chips()).toEqual([]);
	});

	it.each([
		undefined,
		"",
	])("names the selected element as the prompts' subject, or says so when its name is %j", async (label) => {
		await renderPanel({ ...SELECTED, selectedElementLabel: label });

		const shown = chips();
		expect(shown.some((chip) => /selected element/i.test(chip))).toBe(true);
		expect(shown.some((chip) => chip.includes("undefined"))).toBe(false);
	});

	it("shows an element's name on a prompt as plain text", async () => {
		const label = "<img src=x onerror=alert(1)>";

		await renderPanel({ ...SELECTED, selectedElementLabel: label });

		const list = screen.getByTestId("assistant-suggestions");
		expect(list.textContent).toContain(label);
		expect(list.querySelector("img, [onerror]")).toBeNull();
	});

	it("sends exactly the prompt's text with the selection and leaves the draft", async () => {
		await renderPanel(SELECTED);
		const box = screen.getByLabelText("Message the assistant");
		await userEvent.type(box, "my own question");
		const first = within(screen.getByTestId("assistant-suggestions"))
			.getAllByRole("button")
			.at(0) as HTMLElement;
		const sentence = first.textContent ?? "";

		await userEvent.click(first);

		expect(chat.state.sendMessage).toHaveBeenCalledTimes(1);
		expect(chat.state.sendMessage).toHaveBeenCalledWith(
			{ text: sentence },
			{ body: { selectedElementId: "el-1" } }
		);
		expect(box).toHaveValue("my own question");
	});

	it("sends a prompt with no selection when none is selected", async () => {
		await renderPanel(NO_SELECTION);
		const first = within(screen.getByTestId("assistant-suggestions"))
			.getAllByRole("button")
			.at(0) as HTMLElement;

		await userEvent.click(first);

		expect(chat.state.sendMessage).toHaveBeenCalledWith(
			{ text: first.textContent },
			{ body: { selectedElementId: undefined } }
		);
	});

	it("sends nothing when a prompt is clicked while a reply is in progress", async () => {
		chat.state.status = "streaming";
		await renderPanel(SELECTED);

		for (const button of within(
			screen.getByTestId("assistant-suggestions")
		).getAllByRole("button")) {
			await userEvent.click(button);
		}

		expect(chat.state.sendMessage).not.toHaveBeenCalled();
	});

	it("shows neither the prompts nor the introduction once there is a message", async () => {
		chat.state.messages = [user("hi"), assistant(text("Hello.", "done"))];

		await renderPanel(SELECTED);

		expect(screen.queryByTestId("assistant-suggestions")).toBeNull();
		expect(screen.queryByTestId("assistant-intro")).toBeNull();
	});

	it("shows the prompts again for an empty conversation, and not once the user has sent one", async () => {
		const { again } = await renderPanel(SELECTED);
		expect(chips().length).toBeGreaterThan(0);

		chat.state.status = "submitted";
		chat.state.messages = [user("hi")];
		again();

		expect(screen.queryByTestId("assistant-suggestions")).toBeNull();
	});
});

describe("the selection line and the notices", () => {
	it.each([
		[SELECTED, "Selected: P1"],
		[NO_SELECTION, "No element selected"],
		[{ ...SELECTED, selectedElementLabel: undefined }, "Selected: an element"],
	])("shows what is selected", async (ctx, line) => {
		await renderPanel(ctx);

		expect(screen.getByTestId("assistant-selection")).toHaveTextContent(line);
	});

	it("shows the timeout notice as an alert and keeps the input usable", async () => {
		chat.state.messages = [
			user("hi"),
			assistant({ type: "data-notice", data: "timeout" }),
		];

		await renderPanel();

		expect(screen.getByRole("alert")).toHaveTextContent(
			"The model did not answer in time. Try again or ask something shorter."
		);
		expect(screen.getByLabelText("Message the assistant")).toBeEnabled();
	});

	it("points to settings when the route reports the assistant is not configured", async () => {
		chat.state.error = new Error(
			JSON.stringify({ code: "CONFLICT", error: "No key set." })
		);

		await renderPanel();

		expect(screen.getByTestId("assistant-not-configured")).toHaveTextContent(
			"No key set."
		);
		expect(
			screen.getByRole("link", { name: "Open plugin settings" })
		).toHaveAttribute("href", "/dashboard/settings/plugins");
	});

	it("shows a plain alert, not the error's own text, for any other failure", async () => {
		chat.state.error = new Error("ECONNRESET secret-host:5432");

		await renderPanel();

		expect(screen.getByRole("alert")).toHaveTextContent(
			"The assistant could not answer. Try again."
		);
		expect(document.body).not.toHaveTextContent("secret-host");
	});
});

describe("Send and Stop", () => {
	it("Stop ends the reply without sending and keeps the draft", async () => {
		chat.state.status = "streaming";
		await renderPanel(SELECTED);
		const box = screen.getByLabelText("Message the assistant");
		await userEvent.type(box, "next question");

		const stop = screen.getByRole("button", { name: "Stop" });
		expect(stop).toHaveAttribute("type", "button");
		await userEvent.click(stop);

		expect(chat.state.stop).toHaveBeenCalledTimes(1);
		expect(chat.state.sendMessage).not.toHaveBeenCalled();
		expect(box).toHaveValue("next question");
	});

	it("Enter while a reply is in progress sends nothing and keeps the draft", async () => {
		chat.state.status = "streaming";
		await renderPanel(SELECTED);
		const box = screen.getByLabelText("Message the assistant");

		await userEvent.type(box, "next question{Enter}");

		expect(chat.state.sendMessage).not.toHaveBeenCalled();
		expect(box).toHaveValue("next question");
	});

	it("shows Send when idle and Stop while busy, never both", async () => {
		const { again } = await renderPanel(SELECTED);
		expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();

		chat.state.status = "submitted";
		again();

		expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
	});

	it("sends the typed question with the selection and clears the draft", async () => {
		await renderPanel(SELECTED);
		const box = screen.getByLabelText("Message the assistant");

		await userEvent.type(box, "  What does P1 claim?  {Enter}");

		expect(chat.state.sendMessage).toHaveBeenCalledWith(
			{ text: "What does P1 claim?" },
			{ body: { selectedElementId: "el-1" } }
		);
		expect(box).toHaveValue("");
	});
});
