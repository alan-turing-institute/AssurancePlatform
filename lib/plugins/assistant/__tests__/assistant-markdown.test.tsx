// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
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

function show(role: "assistant" | "user", text: string) {
	chat.state.messages = [{ id: "m", role, parts: [{ type: "text", text }] }];
	return renderWithoutProviders(<AssistantPanel {...CTX} />);
}

beforeEach(() => {
	chat.state.messages = [];
});

describe("assistant replies as markdown", () => {
	it("renders **bold** as a strong element", () => {
		show("assistant", "This is **important** here");
		const strong = screen
			.getByTestId("assistant-message-assistant")
			.querySelector("strong");
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

	it("opens links in a new tab with noopener noreferrer", () => {
		show("assistant", "See [the docs](https://example.com/docs)");
		const a = screen.getByRole("link", { name: "the docs" });
		expect(a).toHaveAttribute("href", "https://example.com/docs");
		expect(a).toHaveAttribute("target", "_blank");
		const rel = a.getAttribute("rel") ?? "";
		expect(rel).toContain("noopener");
		expect(rel).toContain("noreferrer");
	});

	it("does not leave a javascript: link live", () => {
		const { container } = show("assistant", "[click](javascript:alert(1))");
		for (const a of container.querySelectorAll("a")) {
			expect(a.getAttribute("href") ?? "").not.toMatch(/^\s*javascript:/i);
		}
	});

	it("does not render a user's message as markdown", () => {
		const { container } = show(
			"user",
			"I wrote **not bold** and [a link](https://example.com)"
		);
		const msg = screen.getByTestId("assistant-message-user");
		expect(msg.querySelector("strong")).toBeNull();
		expect(container.querySelector("a")).toBeNull();
		expect(msg.textContent).toContain("**not bold**");
	});
});
