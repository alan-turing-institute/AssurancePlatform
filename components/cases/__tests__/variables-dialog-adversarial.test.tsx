import { configure, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import NodeEditDialog from "../node-edit-dialog";

// The dialogs, editors and cards are slow to settle on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

/**
 * The edit dialog and variables: marking a name as a variable and saving it,
 * and opening and saving any element (evidence included) without a value or
 * a "[name]" reaching the stored text.
 */

vi.mock("../reference-text-editor", async () => ({
	default: (
		await import("@/src/__tests__/utils/reference-text-editor-stand-in")
	).default,
}));

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

const SYS = "k3f9x2m7qa";
const WIN = "a1b2c3d4e5";
const OTHER = "zzzzzzzzzz";
const SWITCH_NAME = /^Variable: show its value wherever it is mentioned/;
const NOT_SET_NOTE = /Until you give it a value/;
const FIRST_ENTRY_SWITCH = /\(context entry 1\)$/;
const UPDATE_BUTTON = /^Update/;

const PLAIN_ENTRY = { id: WIN, name: "window", text: "the moving interval" };
const VARIABLE = {
	id: SYS,
	name: "system",
	text: "the system under test",
	value: "AcmeBot",
	variable: true as const,
};
const UNSET_VARIABLE = {
	id: SYS,
	name: "system",
	text: "the system under test",
	variable: true as const,
};

function showCase(permissions = "manage"): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
			kind: "CASE",
		},
	});
}

function termsOf(entry: ContextEntry): DefinedTerm[] {
	if (typeof entry === "string") {
		return [];
	}
	return [
		{
			...entry,
			definedOn: { elementId: "1", elementName: "G1" },
		} as DefinedTerm,
	];
}

function claimWith(data: Record<string, unknown>): Node {
	return {
		id: "7",
		type: "property",
		position: { x: 0, y: 0 },
		data: { id: 7, name: "P1", description: "Separation holds", ...data },
	};
}

function evidenceWith(data: Record<string, unknown>): Node {
	return {
		id: "9",
		type: "evidence",
		position: { x: 0, y: 0 },
		data: {
			id: 9,
			name: "E1",
			description: "Tested",
			urls: ["https://example.com/evidence"],
			...data,
		},
	};
}

function capture(elementId: number) {
	const captured: { bodies: Record<string, unknown>[] } = { bodies: [] };
	server.use(
		http.get("/api/user/plugins", () => HttpResponse.json({ plugins: [] })),
		http.put(`/api/elements/${elementId}`, async ({ request }) => {
			captured.bodies.push((await request.json()) as Record<string, unknown>);
			return HttpResponse.json({}, { status: 200 });
		})
	);
	return captured;
}

function renderDialog(
	node: Node,
	nodeType: "property" | "evidence",
	onOpenChange = vi.fn()
) {
	render(
		<NodeEditDialog
			node={node}
			nodeType={nodeType}
			onOpenChange={onOpenChange}
			open={true}
		/>,
		{ withProviders: false }
	);
	return onOpenChange;
}

async function pasteInto(
	user: ReturnType<typeof userEvent.setup>,
	box: HTMLElement,
	text: string
) {
	await user.click(box);
	await user.clear(box);
	await user.paste(text);
}

beforeEach(() => {
	showCase();
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

describe("the variable switch on a named context entry", () => {
	it("marks a named entry as a variable, keeping its value, and sends the flag", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [{ ...PLAIN_ENTRY, value: "5 minutes" }] }),
			"property"
		);

		await user.click(await screen.findByRole("switch", { name: SWITCH_NAME }));
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.context).toEqual([
			{ ...PLAIN_ENTRY, value: "5 minutes", variable: true },
		]);
	});

	it("marks an entry that has no value, and sends it without one", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [PLAIN_ENTRY] }),
			"property"
		);

		await user.click(await screen.findByRole("switch", { name: SWITCH_NAME }));
		expect(screen.getByText(NOT_SET_NOTE)).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const [entry] = (captured.bodies[0]?.context ?? []) as Record<
			string,
			unknown
		>[];
		expect(entry).toEqual({ ...PLAIN_ENTRY, variable: true });
		expect(entry).not.toHaveProperty("value");
	});

	it("unmarks a variable and sends the entry without the flag, keeping its value", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [VARIABLE] }),
			"property"
		);

		const toggle = await screen.findByRole("switch", { name: SWITCH_NAME });
		expect(toggle).toBeChecked();
		await user.click(toggle);
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const [entry] = (captured.bodies[0]?.context ?? []) as Record<
			string,
			unknown
		>[];
		expect(entry).toEqual({
			id: SYS,
			name: "system",
			text: "the system under test",
			value: "AcmeBot",
		});
		expect(entry).not.toHaveProperty("variable");
	});

	it("keeps a variable, with and without a value, exactly as it was on an untouched save", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({
				context: [VARIABLE, { ...UNSET_VARIABLE, id: WIN, name: "other" }],
			}),
			"property"
		);

		await screen.findByRole("switch", { name: FIRST_ENTRY_SWITCH });
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.context).toEqual([
			VARIABLE,
			{ ...UNSET_VARIABLE, id: WIN, name: "other" },
		]);
	});

	it("keeps the switch of each entry apart", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [PLAIN_ENTRY, VARIABLE] }),
			"property"
		);

		const switches = await screen.findAllByRole("switch", {
			name: SWITCH_NAME,
		});
		expect(switches.map((box) => box.getAttribute("aria-checked"))).toEqual([
			"false",
			"true",
		]);
		await user.click(switches[0] as HTMLElement);
		await user.click(switches[1] as HTMLElement);
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const [first, second] = (captured.bodies[0]?.context ?? []) as Record<
			string,
			unknown
		>[];
		expect(first).toHaveProperty("variable", true);
		expect(second).not.toHaveProperty("variable");
	});

	it("sends a variable with a value of only spaces as a variable with no value", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [UNSET_VARIABLE] }),
			"property"
		);

		await pasteInto(
			user,
			await screen.findByLabelText("Context entry 1 value"),
			"     "
		);
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const [entry] = (captured.bodies[0]?.context ?? []) as Record<
			string,
			unknown
		>[];
		expect(entry).toEqual(UNSET_VARIABLE);
		expect(entry).not.toHaveProperty("value");
	});

	it.each([
		["markup", "<img src=x onerror=alert(1)>"],
		["Markdown", "**bold** [x](https://example.test)"],
		["a reference", `{other#${OTHER}}`],
		["a bare brace word", "{other}"],
		["a closing brace and an equals sign", "} ="],
		["a name in square brackets", "[system]"],
		["the longest allowed value", "v".repeat(500)],
	])("sends a pasted value of %s as the value, trimmed and otherwise as it was", async (_what, value) => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [UNSET_VARIABLE] }),
			"property"
		);

		await pasteInto(
			user,
			await screen.findByLabelText("Context entry 1 value"),
			value.length < 500 ? `  ${value}  ` : value
		);
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.context).toEqual([{ ...UNSET_VARIABLE, value }]);
		// A value is only ever a value: it is not copied into the description.
		expect(captured.bodies[0]).not.toHaveProperty("description");
	});

	it("shows the note about square brackets only while a marked entry has no value", async () => {
		const user = userEvent.setup();
		renderDialog(claimWith({ context: [UNSET_VARIABLE] }), "property");

		expect(await screen.findByText(NOT_SET_NOTE)).toBeInTheDocument();
		await user.type(screen.getByLabelText("Context entry 1 value"), "x");
		expect(screen.queryByText(NOT_SET_NOTE)).not.toBeInTheDocument();
	});

	it("offers no switch on an entry that has no name yet", async () => {
		renderDialog(claimWith({ context: ["a plain line"] }), "property");

		await screen.findByLabelText("Context entry 1");
		expect(
			screen.queryByRole("switch", { name: SWITCH_NAME })
		).not.toBeInTheDocument();
	});

	it("drops the variable marker with the name when the name is removed", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: [VARIABLE] }),
			"property"
		);

		await user.click(
			await screen.findByRole("button", {
				name: "Remove name of context entry 1",
			})
		);
		await user.click(
			screen.getByRole("button", { name: "Remove name and value" })
		);
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.context).toEqual(["the system under test"]);
	});

	it("names a plain line again as an ordinary entry, not as a variable", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ context: ["the system under test"] }),
			"property"
		);

		await user.click(
			await screen.findByRole("button", { name: "Name context entry 1" })
		);
		await user.type(screen.getByLabelText("Context entry 1 name"), "system");
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const [entry] = (captured.bodies[0]?.context ?? []) as Record<
			string,
			unknown
		>[];
		expect(entry).toMatchObject({ name: "system" });
		expect(entry).not.toHaveProperty("variable");
	});

	it("shows the switch and its state to a viewer but does not let them change it", async () => {
		showCase("view");
		renderDialog(claimWith({ context: [VARIABLE] }), "property");

		const toggle = await screen.findByRole("switch", { name: SWITCH_NAME });
		expect(toggle).toBeChecked();
		expect(toggle).toBeDisabled();
		expect(screen.queryByRole("button", { name: UPDATE_BUTTON })).toBeNull();
	});
});

describe("the terms list in the dialog", () => {
	it("shows a variable's value beside its name, and that an empty one is not set", async () => {
		renderDialog(
			claimWith({
				context: [],
				termsInReach: [
					...termsOf(VARIABLE),
					...termsOf({ ...UNSET_VARIABLE, id: WIN, name: "other" }),
				],
			}),
			"property"
		);

		const list = (await screen.findByText("Terms you can use here")).closest(
			"section"
		);
		expect(list).toHaveTextContent("system (variable: AcmeBot)");
		expect(list).toHaveTextContent("other (variable, not set)");
		expect(list).not.toHaveTextContent("Value: AcmeBot");
	});

	it("shows an ordinary term's value as before", async () => {
		renderDialog(
			claimWith({
				context: [],
				termsInReach: termsOf({ ...PLAIN_ENTRY, value: "5 minutes" }),
			}),
			"property"
		);

		const list = (await screen.findByText("Terms you can use here")).closest(
			"section"
		);
		expect(list).toHaveTextContent("Value: 5 minutes");
		expect(list).not.toHaveTextContent("variable");
	});

	it("follows a switch flipped in the form before anything is saved", async () => {
		const user = userEvent.setup();
		renderDialog(
			claimWith({
				context: [{ ...PLAIN_ENTRY, value: "5 minutes" }],
				termsInReach: [],
			}),
			"property"
		);

		const list = (await screen.findByText("Terms you can use here")).closest(
			"section"
		);
		expect(list).toHaveTextContent("Value: 5 minutes");
		await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));
		await waitFor(() =>
			expect(list).toHaveTextContent("window (variable: 5 minutes)")
		);
	});

	it("draws a hostile value as text", async () => {
		renderDialog(
			claimWith({
				context: [],
				termsInReach: termsOf({
					...VARIABLE,
					value: "<img src=x onerror=alert(1)>",
				}),
			}),
			"property"
		);

		const list = (await screen.findByText("Terms you can use here")).closest(
			"section"
		);
		expect(list?.querySelector("img")).toBeNull();
		expect(list).toHaveTextContent("variable: <img src=x onerror=alert(1)>");
	});
});

describe("opening and saving an element that mentions a variable", () => {
	const MENTION = `The {system#${SYS}} is safe`;
	const terms = termsOf(VARIABLE);

	it("holds the stored text in the description box, never the value or [name]", async () => {
		capture(7);
		renderDialog(
			claimWith({ description: MENTION, termsInReach: terms }),
			"property"
		);

		expect(await screen.findByLabelText("Description")).toHaveValue(MENTION);
	});

	it("holds the stored text when the variable has no value", async () => {
		capture(7);
		renderDialog(
			claimWith({
				description: MENTION,
				termsInReach: termsOf(UNSET_VARIABLE),
			}),
			"property"
		);

		expect(await screen.findByLabelText("Description")).toHaveValue(MENTION);
	});

	it("leaves the description out of the update when only the assumption was written", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ description: MENTION, termsInReach: terms }),
			"property"
		);

		await user.type(await screen.findByLabelText("Assumption"), "Yearly");
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]).not.toHaveProperty("description");
	});

	it("records the stored text, not the shown words, as before and after in the history", async () => {
		const user = userEvent.setup();
		capture(7);
		const onOpenChange = renderDialog(
			claimWith({ description: MENTION, termsInReach: terms }),
			"property"
		);

		await user.type(await screen.findByLabelText("Assumption"), "Yearly");
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		const whole = JSON.stringify(command);
		expect(command?.before?.description).toBe(MENTION);
		expect(command?.after?.description).toBe(MENTION);
		expect(whole).not.toContain("AcmeBot");
		expect(whole).not.toContain("[system]");
	});

	it("sends the stored text with the new words when the description is edited", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({ description: MENTION, termsInReach: terms }),
			"property"
		);

		const box = await screen.findByLabelText("Description");
		await user.click(box);
		await user.keyboard("{Control>}{End}{/Control} indeed");
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.description).toBe(`${MENTION} indeed`);
	});

	it("does not send a variable's value for an element that is not a variable's owner", async () => {
		const user = userEvent.setup();
		const captured = capture(7);
		const onOpenChange = renderDialog(
			claimWith({
				description: MENTION,
				context: [],
				termsInReach: terms,
			}),
			"property"
		);

		await user.type(await screen.findByLabelText("Assumption"), "Yearly");
		await user.click(screen.getByRole("button", { name: "Update Property" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.context ?? []).toEqual([]);
		expect(JSON.stringify(captured.bodies[0])).not.toContain("AcmeBot");
	});
});

describe("the dialog of a piece of evidence that mentions a variable", () => {
	const MENTION = `Tested the {system#${SYS}} for an hour`;
	const terms = termsOf(VARIABLE);

	it("opens with the stored text in the description box", async () => {
		capture(9);
		renderDialog(
			evidenceWith({ description: MENTION, termsInReach: terms }),
			"evidence"
		);

		expect(await screen.findByLabelText("Description")).toHaveValue(MENTION);
	});

	it("lists the terms in reach, with the variable's value", async () => {
		capture(9);
		renderDialog(
			evidenceWith({ description: MENTION, termsInReach: terms }),
			"evidence"
		);

		const list = (await screen.findByText("Terms you can use here")).closest(
			"section"
		);
		expect(list).toHaveTextContent("system (variable: AcmeBot)");
	});

	it("saves a change to the address without writing a value or [name] into the text", async () => {
		const user = userEvent.setup();
		const captured = capture(9);
		const onOpenChange = renderDialog(
			evidenceWith({ description: MENTION, termsInReach: terms }),
			"evidence"
		);

		const address = await screen.findByDisplayValue(
			"https://example.com/evidence"
		);
		await user.type(address, "/more");
		await user.click(screen.getByRole("button", { name: "Update Evidence" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		const body = captured.bodies[0] ?? {};
		if ("description" in body) {
			expect(body.description).toBe(MENTION);
		}
		const everything = JSON.stringify([
			body,
			useHistoryStore.getState().undoStack,
		]);
		expect(everything).not.toContain("AcmeBot");
		expect(everything).not.toContain("[system]");
	});

	it("saves the stored text, with the token, when the description is edited", async () => {
		const user = userEvent.setup();
		const captured = capture(9);
		const onOpenChange = renderDialog(
			evidenceWith({
				description: MENTION,
				termsInReach: termsOf(UNSET_VARIABLE),
			}),
			"evidence"
		);

		const box = await screen.findByLabelText("Description");
		await user.click(box);
		await user.keyboard("{Control>}{End}{/Control}!");
		await user.click(screen.getByRole("button", { name: "Update Evidence" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(captured.bodies[0]?.description).toBe(`${MENTION}!`);
		expect(JSON.stringify(captured.bodies[0])).not.toContain("[system]");
	});

	it("shows the same dialog to an evidence element that mentions nothing, as before", async () => {
		capture(9);
		renderDialog(evidenceWith({ description: "Plain text" }), "evidence");

		expect(await screen.findByLabelText("Description")).toHaveValue(
			"Plain text"
		);
		expect(
			screen.queryByRole("switch", { name: SWITCH_NAME })
		).not.toBeInTheDocument();
	});
});
