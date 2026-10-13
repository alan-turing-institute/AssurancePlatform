import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/lib/plugins/assistant/use-assistant-tools", () => ({
	useAssistantTools: () => null,
}));

const CTX = {
	canEdit: false,
	caseId: "case-1",
	selectedElementId: undefined,
	selectedElementLabel: undefined,
};

function show(role: "assistant" | "user", text: string) {
	chat.state.messages = [{ id: "m", role, parts: [{ type: "text", text }] }];
	return renderWithoutProviders(<AssistantPanel {...CTX} />);
}

beforeEach(() => {
	chat.state.messages = [];
	chat.state.status = "ready";
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("assistant replies as markdown", () => {
	it("renders **bold** as strong text", () => {
		show("assistant", "This is **important** here");
		const strong = screen
			.getByTestId("assistant-message-assistant")
			.querySelector('[data-streamdown="strong"]');
		expect(strong?.textContent).toBe("important");
	});

	it("renders lists", () => {
		show("assistant", "- one\n- two");
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("shows a script tag as text and creates no script element", () => {
		const { container } = show(
			"assistant",
			"before <script>alert(1)</script> after"
		);
		expect(container.querySelectorAll("script")).toHaveLength(0);
		expect(
			screen.getByTestId("assistant-message-assistant").textContent
		).toContain("<script>alert(1)</script>");
	});

	it("shows an img with an onerror handler as text and creates no img element", () => {
		const { container } = show(
			"assistant",
			'x <img src=x onerror="alert(1)"> y'
		);
		expect(container.querySelectorAll("img")).toHaveLength(0);
		expect(container.querySelector("[onerror]")).toBeNull();
		expect(
			screen.getByTestId("assistant-message-assistant").textContent
		).toContain("onerror");
	});

	it("creates no img element for markdown image syntax either", () => {
		const { container } = show(
			"assistant",
			"![pic](https://evil.example/p.png)"
		);
		expect(container.querySelectorAll("img")).toHaveLength(0);
	});

	it("shows the alt text of a markdown image in its place", () => {
		show("assistant", "![the diagram](https://evil.example/p.png)");

		expect(screen.getByTestId("assistant-message-assistant")).toHaveTextContent(
			"the diagram"
		);
	});

	it("opens a link in a new tab only after the reader confirms", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		show("assistant", "See [the docs](https://example.com/docs)");

		await userEvent.click(screen.getByRole("button", { name: "the docs" }));

		expect(open).not.toHaveBeenCalled();
		expect(screen.getByText("Open external link?")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Open link" }));

		expect(open).toHaveBeenCalledWith(
			"https://example.com/docs",
			"_blank",
			"noreferrer"
		);
	});

	it("does not leave a javascript: link live", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		const { container } = show("assistant", "[click](javascript:alert(1))");

		await userEvent.click(screen.getByText("click", { exact: false }));

		expect(open).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "click" })).toBeNull();
		for (const a of container.querySelectorAll("a")) {
			expect(a.getAttribute("href") ?? "").not.toContain("javascript:");
		}
	});

	it("does not render a user's message as markdown", () => {
		const { container } = show(
			"user",
			"I wrote **not bold** and [a link](https://example.com)"
		);
		const msg = screen.getByTestId("assistant-message-user");
		expect(msg.querySelector('[data-streamdown="strong"]')).toBeNull();
		expect(container.querySelector("a")).toBeNull();
		expect(screen.queryByRole("button", { name: "a link" })).toBeNull();
		expect(msg.textContent).toContain("**not bold**");
	});
});

describe("assistant thinking as markdown", () => {
	it("shows HTML and an image in the thinking text as text", () => {
		chat.state.status = "streaming";
		chat.state.messages = [
			{
				id: "m",
				role: "assistant",
				parts: [
					{
						type: "reasoning",
						state: "streaming",
						text: 'Try <script>alert(1)</script> and <img src=x onerror="alert(1)"> and ![chart](https://evil.example/c.png)',
					},
				],
			},
		];
		const { container } = renderWithoutProviders(<AssistantPanel {...CTX} />);

		const thinking = screen.getByTestId("assistant-reasoning");
		expect(thinking).toHaveTextContent("<script>alert(1)</script>");
		expect(thinking).toHaveTextContent("onerror");
		expect(thinking).toHaveTextContent("chart");
		expect(container.querySelectorAll("script, img")).toHaveLength(0);
		expect(container.querySelector("[onerror]")).toBeNull();
	});
});

/** Shows the text as a reply, or as the model's thinking with the block opened. */
async function showModelText(surface: "reply" | "thinking", text: string) {
	if (surface === "reply") {
		return show("assistant", text);
	}
	chat.state.messages = [
		{
			id: "m",
			role: "assistant",
			parts: [{ type: "reasoning", text, state: "done" }],
		},
	];
	const rendered = renderWithoutProviders(<AssistantPanel {...CTX} />);
	await userEvent.click(
		within(screen.getByTestId("assistant-reasoning")).getByRole("button")
	);
	return rendered;
}

describe.each([
	"reply",
	"thinking",
] as const)("a diagram or an unusual link in the %s", (surface) => {
	it("shows a diagram as code and does not draw it", async () => {
		const { container } = await showModelText(
			surface,
			"```mermaid\ngraph TD\n A[\"<img src='https://evil.example/m.png'>\"]\n```"
		);

		await waitFor(() =>
			expect(
				container.querySelector(
					'[data-streamdown="code-block"][data-language="mermaid"]'
				)
			).not.toBeNull()
		);
		expect(
			container.querySelector('[data-streamdown="mermaid-block"]')
		).toBeNull();
	});

	it.each([
		["xmpp", "[x](xmpp:a@b.c)", "x"],
		["irc", "[i](irc://e.example/c)", "i"],
	])("leaves an %s link as plain text with no button", async (_name, markdown, label) => {
		const { container } = await showModelText(surface, markdown);

		await waitFor(() =>
			expect(
				screen.getByTestId("assistant-message-assistant")
			).toHaveTextContent(label)
		);
		expect(screen.queryByRole("button", { name: label })).toBeNull();
		expect(container.querySelector("a, [data-streamdown='link']")).toBeNull();
		expect(container).not.toHaveTextContent("blocked");
	});
});
