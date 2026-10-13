import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CasePanelSheet } from "@/components/cases/case-panel-sheet";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AssistantPanel } from "../assistant-panel";

// The shared setup swaps Radix Dialog for a stub; focus and Escape need the real one.
vi.mock("@radix-ui/react-dialog", () =>
	vi.importActual("@radix-ui/react-dialog")
);

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
	useAssistantTools: () => [],
}));

const URL_IN_TEXT = "https://example.com/docs";

/** The assistant panel inside the sheet that holds it on the case page. */
function showReplyWithLink(surface: "reply" | "thinking") {
	const link = `See [the docs](${URL_IN_TEXT}) now`;
	chat.state.messages = [
		{
			id: "m",
			role: "assistant",
			parts:
				surface === "reply"
					? [{ type: "text", text: link }]
					: [
							{ type: "reasoning", text: link, state: "done" },
							{ type: "text", text: "Done.", state: "done" },
						],
		},
	];
	const onClose = vi.fn();
	renderWithoutProviders(
		<CasePanelSheet
			canEdit={false}
			caseId="case-1"
			isOpen
			onClose={onClose}
			registration={{
				Component: AssistantPanel,
				label: "Case assistant",
				modal: false,
				panelId: "tea.assistant",
				pluginId: "tea.assistant",
			}}
			returnFocusTo={{ current: null }}
		/>
	);
	return { onClose };
}

async function openFromKeyboard(surface: "reply" | "thinking") {
	if (surface === "thinking") {
		screen.getByTestId("assistant-reasoning").querySelector("button")?.focus();
		await userEvent.keyboard("{Enter}");
	}
	const link = await screen.findByRole("button", { name: "the docs" });
	link.focus();
	await userEvent.keyboard("{Enter}");
	return link;
}

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	chat.state.status = "ready";
	openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
	openSpy.mockRestore();
});

describe.each([
	"reply",
	"thinking",
] as const)("the link confirmation in the %s, used from the keyboard", (surface) => {
	it("moves focus into the dialog and keeps Tab inside it", async () => {
		showReplyWithLink(surface);

		await openFromKeyboard(surface);

		const dialog = screen.getByRole("alertdialog", {
			name: "Open external link?",
		});
		expect(dialog).toHaveTextContent(URL_IN_TEXT);
		expect(dialog).toHaveClass("nokey");
		expect(dialog).toContainElement(document.activeElement as HTMLElement);
		for (let presses = 0; presses < 5; presses++) {
			await userEvent.tab();
			expect(dialog).toContainElement(document.activeElement as HTMLElement);
		}
		await userEvent.tab({ shift: true });
		expect(dialog).toContainElement(document.activeElement as HTMLElement);
	});

	it("closes only the dialog on Escape, and gives focus back to the link", async () => {
		const { onClose } = showReplyWithLink(surface);
		const link = await openFromKeyboard(surface);

		await userEvent.keyboard("{Escape}");

		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByTestId("assistant-selection")).toBeInTheDocument();
		expect(link).toHaveFocus();
		expect(openSpy).not.toHaveBeenCalled();
	});

	it("opens the link in a new tab from the Open link action, reached by Tab", async () => {
		const { onClose } = showReplyWithLink(surface);
		await openFromKeyboard(surface);

		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Open link" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");

		expect(openSpy).toHaveBeenCalledTimes(1);
		expect(openSpy).toHaveBeenCalledWith(URL_IN_TEXT, "_blank", "noreferrer");
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("opens nothing from Cancel", async () => {
		showReplyWithLink(surface);
		const link = await openFromKeyboard(surface);

		expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");

		expect(openSpy).not.toHaveBeenCalled();
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(link).toHaveFocus();
	});
});
