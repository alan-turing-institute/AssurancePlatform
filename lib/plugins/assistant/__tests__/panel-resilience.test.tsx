import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
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

describe("reply text that nests deeply", () => {
	it("is shown without breaking the page", () => {
		chat.state.messages = [
			{
				id: "m",
				role: "assistant",
				parts: [{ type: "text", text: `${"> ".repeat(1000)}deep` }],
			},
		];

		const render = () => renderWithoutProviders(<AssistantPanel {...CTX} />);

		expect(render).not.toThrow();
		expect(screen.getByTestId("assistant-message-assistant")).toHaveTextContent(
			"deep"
		);
	});
});
