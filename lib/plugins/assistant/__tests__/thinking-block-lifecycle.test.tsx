import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	vi.stubGlobal(
		"fetch",
		vi.fn(() => Promise.resolve(Response.json({ tools: [] })))
	);
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

const user = { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] };
const assistant = (...parts: object[]) => ({
	id: "a1",
	role: "assistant",
	parts,
});
const thinking = (text: string, state: "streaming" | "done") => ({
	type: "reasoning",
	text,
	state,
});
const tool = (state: string) => ({
	type: "tool-read_case",
	toolCallId: "t1",
	state,
	input: {},
	...(state === "output-available" ? { output: {} } : {}),
});

describe("a reply with thinking in several steps", () => {
	it("leaves one thinking block, collapsed, once the reply is complete", async () => {
		chat.state.status = "streaming";
		chat.state.messages = [
			user,
			assistant(thinking("first plan", "streaming")),
		];
		const { rerender } = renderWithoutProviders(<AssistantPanel {...CTX} />);
		const trigger = () =>
			within(screen.getByTestId("assistant-reasoning")).getByRole("button");
		const show = (status: string, ...parts: object[]) => {
			chat.state.status = status;
			chat.state.messages = [user, assistant(...parts)];
			rerender(<AssistantPanel {...CTX} />);
		};
		expect(trigger()).toHaveAttribute("aria-expanded", "true");

		// The first thinking ends and a tool runs for longer than the block's close delay.
		show("streaming", thinking("first plan", "done"), tool("input-available"));
		await waitFor(
			() => expect(trigger()).toHaveAttribute("aria-expanded", "false"),
			3000
		);

		// The model thinks again after the tool result.
		show(
			"streaming",
			thinking("first plan", "done"),
			tool("output-available"),
			thinking("second plan", "streaming")
		);
		await waitFor(() =>
			expect(trigger()).toHaveAttribute("aria-expanded", "true")
		);

		show(
			"ready",
			thinking("first plan", "done"),
			tool("output-available"),
			thinking("second plan", "done"),
			{ type: "text", text: "The answer.", state: "done" }
		);

		expect(screen.getAllByTestId("assistant-reasoning")).toHaveLength(1);
		await waitFor(
			() => expect(trigger()).toHaveAttribute("aria-expanded", "false"),
			3000
		);
	});
});

describe("thinking text that nests deeply", () => {
	it("is shown without breaking the page", async () => {
		chat.state.messages = [
			{
				id: "m",
				role: "assistant",
				parts: [
					{
						type: "reasoning",
						text: `${"> ".repeat(1000)}deep`,
						state: "done",
					},
				],
			},
		];

		const render = () => renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(render).not.toThrow();
		await userEvent.click(
			within(screen.getByTestId("assistant-reasoning")).getByRole("button")
		);
		expect(screen.getByTestId("assistant-message-assistant")).toHaveTextContent(
			"deep"
		);
	});
});
