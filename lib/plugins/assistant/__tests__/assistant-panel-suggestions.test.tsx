import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySuggestion } from "@/lib/plugins/assistant/apply-suggestion";
import { getCaseOutcomes } from "@/lib/plugins/assistant/suggestion-outcomes";
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
		setMessages: vi.fn(),
		clearError: vi.fn(),
	},
}));
const session = vi.hoisted(() => ({
	value: { data: { user: { id: "u1" } }, status: "authenticated" },
}));
const assistantTools = vi.hoisted(() => ({
	value: null as string[] | null,
}));

vi.mock("@ai-sdk/react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@ai-sdk/react")>()),
	useChat: () => chat.state,
}));
vi.mock("next-auth/react", () => ({ useSession: () => session.value }));
vi.mock("@/lib/plugins/assistant/chat-store", () => ({
	getCaseChat: vi.fn(() => ({})),
}));
vi.mock("@/lib/plugins/assistant/use-assistant-tools", () => ({
	useAssistantTools: () => assistantTools.value,
}));
vi.mock("@/lib/plugins/assistant/apply-suggestion", () => ({
	applySuggestion: vi.fn(),
}));

const READ_TOOLS = ["read_case", "read_element", "lint_case"];
const WITH_SUGGESTIONS = [...READ_TOOLS, "suggest_edit", "suggest_new_element"];

const CTX = {
	canEdit: true,
	caseId: "case-1",
	selectedElementId: "el-1",
	selectedElementLabel: "G1",
};

function suggestionCall(toolCallId: string, after: string) {
	return {
		type: "tool-suggest_edit",
		toolCallId,
		state: "output-available",
		input: { elementId: "p1" },
		output: {
			suggested: true,
			kind: "edit",
			elementId: "p1",
			elementType: "property_claim",
			label: "P1",
			changes: { description: { before: "Old", after } },
		},
	};
}

function chatWith(...parts: unknown[]) {
	chat.state.messages = [
		{
			id: "m1",
			role: "user",
			parts: [{ type: "text", text: "Reword P1 and P2" }],
		},
		{ id: "m2", role: "assistant", parts },
	];
}

async function ask(text: string) {
	await userEvent.type(
		screen.getByLabelText("Message the assistant"),
		`${text}{Enter}`
	);
}

function lastSentBody() {
	const calls = chat.state.sendMessage.mock.calls;
	return calls.at(-1)?.[1]?.body as Record<string, unknown>;
}

function cardFor(text: string) {
	const card = screen
		.getAllByTestId("assistant-suggestion")
		.find((candidate) => candidate.textContent?.includes(text));
	if (!card) {
		throw new Error(`No card suggests ${text}`);
	}
	return card;
}

beforeEach(() => {
	assistantTools.value = WITH_SUGGESTIONS;
	session.value = { data: { user: { id: "u1" } }, status: "authenticated" };
	chat.state.messages = [];
	chat.state.status = "ready";
	chat.state.error = undefined;
	chat.state.sendMessage.mockReset();
	chat.state.setMessages.mockReset();
	chat.state.stop.mockReset();
	chat.state.clearError.mockReset();
	vi.mocked(applySuggestion).mockReset();
	for (const caseId of ["case-1", "case-2"]) {
		for (const userId of ["u1", "u2"]) {
			getCaseOutcomes(userId, caseId).clear();
		}
	}
});

describe("AssistantPanel: suggestion cards", () => {
	it("shows a suggestion open in the chat, without opening its tool row", () => {
		chatWith(suggestionCall("call-1", "Brand new wording"));
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-suggestion")).toHaveTextContent(
			"Brand new wording"
		);
		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
	});

	it("offers no Apply to a user without edit rights", () => {
		chatWith(suggestionCall("call-1", "Brand new wording"));
		renderWithoutProviders(<AssistantPanel {...CTX} canEdit={false} />);

		expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
	});

	it("keeps each card's decision to that card", async () => {
		chatWith(
			suggestionCall("call-1", "First wording"),
			suggestionCall("call-2", "Second wording")
		);
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		await userEvent.click(
			within(cardFor("Second wording")).getByRole("button", { name: "Dismiss" })
		);

		expect(cardFor("Second wording")).toHaveTextContent("Dismissed");
		expect(
			within(cardFor("First wording")).getByRole("button", { name: "Apply" })
		).toBeEnabled();
	});

	it("sends each decision with the next question, by tool call id", async () => {
		vi.mocked(applySuggestion).mockResolvedValue({ status: "applied" });
		chatWith(
			suggestionCall("call-1", "First wording"),
			suggestionCall("call-2", "Second wording"),
			suggestionCall("call-3", "Third wording")
		);
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		await userEvent.click(
			within(cardFor("First wording")).getByRole("button", { name: "Apply" })
		);
		await waitFor(() =>
			expect(cardFor("First wording")).toHaveTextContent("Applied")
		);
		await userEvent.click(
			within(cardFor("Second wording")).getByRole("button", { name: "Dismiss" })
		);
		await ask("What changed?");

		expect(lastSentBody()).toEqual({
			selectedElementId: "el-1",
			suggestionOutcomes: { "call-1": "applied", "call-2": "dismissed" },
		});
	});

	it("applies in the open case, and records that the element had changed when Apply says so", async () => {
		vi.mocked(applySuggestion).mockResolvedValue({ status: "changed" });
		chatWith(suggestionCall("call-1", "First wording"));
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));

		await waitFor(() =>
			expect(screen.getByTestId("assistant-suggestion")).toHaveTextContent(
				"changed since"
			)
		);
		expect(applySuggestion).toHaveBeenCalledWith("case-1", expect.anything());
		await ask("Try again");
		expect(lastSentBody()).toMatchObject({
			suggestionOutcomes: { "call-1": "changed" },
		});
	});

	it("sends no decision for a save that failed, so the card can be tried again", async () => {
		vi.mocked(applySuggestion).mockResolvedValue({
			status: "failed",
			message: "No permission.",
		});
		chatWith(suggestionCall("call-1", "First wording"));
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(
			await within(screen.getByTestId("assistant-suggestion")).findByRole(
				"alert"
			)
		).toHaveTextContent("No permission.");
		await ask("Anything else?");

		expect(lastSentBody()).toEqual({
			selectedElementId: "el-1",
			suggestionOutcomes: {},
		});
	});
});

describe("AssistantPanel: the decisions of a chat", () => {
	it("clears them when a new chat starts", async () => {
		chatWith(suggestionCall("call-1", "First wording"));
		renderWithoutProviders(<AssistantPanel {...CTX} />);
		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

		await userEvent.click(screen.getByRole("button", { name: "New chat" }));
		await ask("A fresh question");

		expect(lastSentBody()).toMatchObject({ suggestionOutcomes: {} });
		expect(getCaseOutcomes("u1", "case-1").snapshot()).toEqual({});
	});

	it("keeps them when the panel is closed and opened again", async () => {
		chatWith(suggestionCall("call-1", "First wording"));
		const { unmount } = renderWithoutProviders(<AssistantPanel {...CTX} />);
		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		unmount();

		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-suggestion")).toHaveTextContent(
			"Dismissed"
		);
		expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
	});

	it("does not carry them to another case or another user", async () => {
		chatWith(suggestionCall("call-1", "First wording"));
		const { unmount } = renderWithoutProviders(<AssistantPanel {...CTX} />);
		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		unmount();

		renderWithoutProviders(<AssistantPanel {...CTX} caseId="case-2" />);
		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
		await ask("In another case");
		expect(lastSentBody()).toMatchObject({ suggestionOutcomes: {} });
	});

	it("does not carry them to another signed-in user of the same case", () => {
		getCaseOutcomes("u1", "case-1").record("call-1", "applied");
		session.value = { data: { user: { id: "u2" } }, status: "authenticated" };
		chatWith(suggestionCall("call-1", "First wording"));

		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
	});
});

describe("AssistantPanel: what the introduction promises", () => {
	it("says the assistant never changes the case when it has no suggestion tools", () => {
		assistantTools.value = READ_TOOLS;
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		const intro = screen.getByTestId("assistant-intro");
		expect(intro).toHaveTextContent("never changes");
		expect(intro).not.toHaveTextContent("suggests");
		expect(intro).not.toHaveTextContent("apply");
	});

	it("says the user chooses whether to apply a change when it has the suggestion tools", () => {
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		const intro = screen.getByTestId("assistant-intro");
		expect(intro).toHaveTextContent("suggests");
		expect(intro).toHaveTextContent("apply");
	});

	it("keeps the read-only wording while it is not yet known which tools the assistant has", () => {
		assistantTools.value = null;
		renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(screen.getByTestId("assistant-intro")).not.toHaveTextContent(
			"suggests"
		);
	});
});
