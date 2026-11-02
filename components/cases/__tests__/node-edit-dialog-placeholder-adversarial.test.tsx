import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import NodeEditDialog from "../node-edit-dialog";

vi.mock("../reference-text-editor", async () => ({
	default: (
		await import("@/src/__tests__/utils/reference-text-editor-stand-in")
	).default,
}));

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

type Kind = "CASE" | "PATTERN";

const HINT = "Say what this claim asserts";
const SWITCH_NAME = /^Placeholder/;
const MESSAGE = /description|text|written|write/i;
const HINT_FIELD = /^Hint for/;
const LIMIT_MESSAGE = /500/;

/** Where an element comes in the document, so one can ask what is above or below another. */
function positionOf(element: Element): number {
	return Array.from(document.querySelectorAll("*")).indexOf(element);
}
const MIN_LENGTH_MESSAGE = "Description must be at least 2 characters";

function showCase(kind: Kind, permissions = "manage"): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
			kind,
		},
	});
}

function claim(data: Record<string, unknown>): Node {
	return {
		id: "11",
		type: "property",
		position: { x: 0, y: 0 },
		data: { id: 11, name: "P1", description: "", ...data },
	};
}

function captureUpdate() {
	const captured: { bodies: Record<string, unknown>[] } = { bodies: [] };
	server.use(
		http.get("/api/user/plugins", () => HttpResponse.json({ plugins: [] })),
		http.put("/api/elements/11", async ({ request }) => {
			captured.bodies.push((await request.json()) as Record<string, unknown>);
			return HttpResponse.json({}, { status: 200 });
		})
	);
	return captured;
}

function renderClaim(node: Node, onOpenChange = vi.fn()) {
	render(
		<NodeEditDialog
			node={node}
			nodeType="property"
			onOpenChange={onOpenChange}
			open={true}
		/>,
		{ withProviders: false }
	);
	return onOpenChange;
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "Update Property" }));
}

/** Replaces the text of the description box. */
async function replaceDescription(
	user: ReturnType<typeof userEvent.setup>,
	text: string
) {
	const box = await screen.findByLabelText("Description");
	await user.clear(box);
	if (text !== "") {
		await user.type(box, text);
	}
}

beforeEach(() => {
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("the edit dialog of a placeholder in a case", () => {
	beforeEach(() => showCase("CASE"));

	it("shows the hint above the description, and offers no switch", async () => {
		captureUpdate();
		renderClaim(claim({ isPlaceholder: true, placeholderHint: HINT }));

		const hint = await screen.findByText(HINT);
		const description = screen.getByLabelText("Description");

		expect(positionOf(hint)).toBeLessThan(positionOf(description));
		expect(screen.queryByRole("switch")).not.toBeInTheDocument();
	});

	it.each([
		["an element that is not a placeholder", { placeholderHint: HINT }],
		["a placeholder with no hint", { isPlaceholder: true }],
	])("shows no hint for %s", async (_what, data) => {
		captureUpdate();
		renderClaim(claim(data));

		await screen.findByLabelText("Description");

		expect(screen.queryByText(HINT)).not.toBeInTheDocument();
		expect(screen.queryByText("To fill in:")).not.toBeInTheDocument();
	});

	it("sends the new text without the marker, and records the marker on before and off after", async () => {
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(
			claim({ isPlaceholder: true, placeholderHint: HINT })
		);

		await replaceDescription(user, "Operators are trained");
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]).toHaveProperty(
			"description",
			"Operators are trained"
		);
		expect(captured.bodies[0]).not.toHaveProperty("isPlaceholder");
		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		expect(command?.before).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
			description: "",
		});
		expect(command?.after).toMatchObject({
			isPlaceholder: false,
			description: "Operators are trained",
		});
	});

	it("keeps the marker on in the history when only the assumption is written", async () => {
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(
			claim({ isPlaceholder: true, placeholderHint: HINT })
		);

		await user.type(await screen.findByLabelText("Assumption"), "Yearly");
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]).not.toHaveProperty("description");
		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		expect(command?.after?.isPlaceholder).toBe(true);
	});

	it("does not record a marker for an element that was not a placeholder", async () => {
		const user = userEvent.setup();
		captureUpdate();
		const onOpenChange = renderClaim(claim({ description: "Already written" }));

		await replaceDescription(user, "Rewritten");
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		expect(command?.after?.isPlaceholder).not.toBe(true);
		expect(command?.before?.isPlaceholder).not.toBe(true);
	});
});

describe("a description of only spaces in the edit dialog", () => {
	it.each([
		"CASE",
		"PATTERN",
	] as const)("is refused for an element with text in a %s, and nothing is saved", async (kind) => {
		showCase(kind);
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(claim({ description: "Already written" }));

		await replaceDescription(user, "  ");
		await submit(user);

		expect(await screen.findByText(MIN_LENGTH_MESSAGE)).toBeInTheDocument();
		expect(captured.bodies).toHaveLength(0);
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
		expect(useHistoryStore.getState().undoStack).toHaveLength(0);
	});
});

describe("the edit dialog of a pattern", () => {
	beforeEach(() => showCase("PATTERN"));

	it("shows the switch with the state of the element, and no hint above the description", async () => {
		captureUpdate();
		renderClaim(claim({ isPlaceholder: true, placeholderHint: HINT }));

		const toggle = await screen.findByRole("switch", { name: SWITCH_NAME });

		expect(toggle).toBeChecked();
		expect(screen.queryByText("To fill in:")).not.toBeInTheDocument();
		expect(screen.getByLabelText(HINT_FIELD)).toHaveValue(HINT);
	});

	it("shows the hint field only while the switch is on", async () => {
		const user = userEvent.setup();
		captureUpdate();
		renderClaim(claim({ description: "An example claim" }));

		const toggle = await screen.findByRole("switch", { name: SWITCH_NAME });
		expect(screen.queryByLabelText(HINT_FIELD)).not.toBeInTheDocument();

		await user.click(toggle);
		expect(await screen.findByLabelText(HINT_FIELD)).toBeInTheDocument();

		await user.click(toggle);
		expect(screen.queryByLabelText(HINT_FIELD)).not.toBeInTheDocument();
	});

	it("saves the marker on with a trimmed hint, and leaves the text alone", async () => {
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(
			claim({ description: "An example claim" })
		);

		await user.click(await screen.findByRole("switch", { name: SWITCH_NAME }));
		await user.type(
			await screen.findByLabelText(HINT_FIELD),
			"  Name the hazard  "
		);
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Name the hazard",
		});
		expect(captured.bodies[0]).not.toHaveProperty("description");
	});

	it("saves the marker off with the hint cleared, and records the switch-on state as the one to undo to", async () => {
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(
			claim({
				description: "An example claim",
				isPlaceholder: true,
				placeholderHint: HINT,
			})
		);

		await user.click(await screen.findByRole("switch", { name: SWITCH_NAME }));
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]).toMatchObject({
			isPlaceholder: false,
			placeholderHint: "",
		});
		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		expect(command?.before).toMatchObject({
			isPlaceholder: true,
			placeholderHint: HINT,
		});
		expect(command?.after).toMatchObject({ isPlaceholder: false });
	});

	it("saves a placeholder with no text, since the person using the pattern writes it", async () => {
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(claim({ description: "" }));

		await user.click(await screen.findByRole("switch", { name: SWITCH_NAME }));
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]).toMatchObject({ isPlaceholder: true });
	});

	it("keeps the marker on in the history when the text of a placeholder is written", async () => {
		const user = userEvent.setup();
		captureUpdate();
		const onOpenChange = renderClaim(
			claim({ isPlaceholder: true, placeholderHint: HINT })
		);

		await replaceDescription(user, "An example claim");
		await submit(user);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		expect(command?.after).toMatchObject({
			isPlaceholder: true,
			description: "An example claim",
		});
	});

	it("refuses a hint of more than 500 characters and saves nothing", async () => {
		const user = userEvent.setup();
		const captured = captureUpdate();
		const onOpenChange = renderClaim(
			claim({ description: "An example claim", isPlaceholder: true })
		);

		const hint = await screen.findByLabelText(HINT_FIELD);
		await user.click(hint);
		await user.paste("x".repeat(501));
		await submit(user);

		expect(await screen.findByText(LIMIT_MESSAGE)).toBeInTheDocument();
		expect(captured.bodies).toHaveLength(0);
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	it("disables the switch for a reader who cannot edit", async () => {
		showCase("PATTERN", "view");
		captureUpdate();
		renderClaim(claim({ isPlaceholder: true, placeholderHint: HINT }));

		const toggle = await screen.findByRole("switch", { name: SWITCH_NAME });

		expect(toggle).toBeDisabled();
	});

	describe("switching off a placeholder that has no text", () => {
		/** Notes after the switch and before the Update button that talk about the text. */
		function notesBesideSwitch(): HTMLElement[] {
			const toggle = screen.getByRole("switch", { name: SWITCH_NAME });
			const update = screen.getByRole("button", { name: "Update Property" });
			const dialog = toggle.closest("form") ?? document.body;
			return within(dialog)
				.queryAllByText(MESSAGE)
				.filter(
					(note) =>
						positionOf(note) > positionOf(toggle) &&
						positionOf(note) < positionOf(update)
				);
		}

		it("says next to the switch that the element needs text first, before Update is pressed", async () => {
			const user = userEvent.setup();
			captureUpdate();
			renderClaim(claim({ description: "", isPlaceholder: true }));
			const toggle = await screen.findByRole("switch", { name: SWITCH_NAME });
			expect(notesBesideSwitch()).toHaveLength(0);

			await user.click(toggle);

			await waitFor(() =>
				expect(notesBesideSwitch().length).toBeGreaterThan(0)
			);
		});

		it("says nothing of the kind when the placeholder already has text", async () => {
			const user = userEvent.setup();
			captureUpdate();
			renderClaim(
				claim({ description: "An example claim", isPlaceholder: true })
			);

			await user.click(
				await screen.findByRole("switch", { name: SWITCH_NAME })
			);

			expect(notesBesideSwitch()).toHaveLength(0);
		});
	});
});
