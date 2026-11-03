// biome-ignore-all lint/suspicious/noMisplacedAssertion: the helper is called from within it() blocks
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import type { HistoryCommand } from "@/types/history";
import JsonViewPanel from "../json-view-panel";

/**
 * Marking a name as a variable in the JSON editor: the document is checked,
 * the difference reaches the batch route with the flag, and Undo and Redo
 * send the entries back as they were and as they became. A document with a
 * flag that is not a boolean, or a 1.0 document that holds a variable, is not
 * applied; a flag of `false` is applied as the flag taken off.
 */

vi.unmock("@radix-ui/react-dialog");

// The editor and its validation are slow on a busy machine.
vi.setConfig({ testTimeout: 20_000 });
const WAIT = { timeout: 10_000 };

const ROOT_ID = "11111111-1111-4111-8111-111111111111";
const APPLY_PATTERN = /^Apply$/;
const ERRORS_PATTERN = /^\d+ errors?$/;

type Entry = Record<string, unknown>;

const PLAIN: Entry = {
	id: "k3f9x2m7qa",
	name: "system",
	text: "the system under test",
	value: "AcmeBot",
};
const VARIABLE: Entry = { ...PLAIN, variable: true };
const UNSET: Entry = {
	id: "k3f9x2m7qa",
	name: "system",
	text: "the system under test",
	variable: true,
};

interface Doc {
	case: { description: string; name: string };
	exportedAt: string;
	tree: Record<string, unknown>;
	version: string;
}

function docWith(
	context: Entry[],
	description = "The system is safe",
	version = "1.1"
): Doc {
	return {
		version,
		exportedAt: "2026-11-02T10:00:00.000Z",
		case: { name: "Test", description: "A case" },
		tree: {
			id: ROOT_ID,
			type: "GOAL",
			name: "G1",
			description,
			inSandbox: false,
			context,
			children: [],
		},
	};
}

let served: Doc = docWith([PLAIN]);

vi.mock("@/actions/export-case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/actions/export-case")>();
	return {
		...actual,
		exportCase: vi.fn(async () => ({ data: structuredClone(served) })),
	};
});

vi.mock("@/lib/case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/case")>();
	return { ...actual, fetchAndRefreshCase: vi.fn(async () => null) };
});

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockImplementation(() =>
		Promise.resolve({
			ok: true,
			json: () =>
				Promise.resolve({ summary: { created: 0, updated: 1, deleted: 0 } }),
		} as Response)
	);
	vi.stubGlobal("fetch", fetchMock);
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			kind: "CASE",
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Opens the JSON editor on `served` and replaces its text with `edited`. */
async function typeDocument(edited: Doc | string) {
	const user = userEvent.setup();
	render(<JsonViewPanel isOpen={true} onClose={vi.fn()} />);
	const content = await waitFor(() => {
		const element = document.querySelector(".cm-content");
		expect(element?.textContent).toContain("G1");
		return element as HTMLElement;
	}, WAIT);
	await user.click(content);
	await user.keyboard("{Control>}a{/Control}");
	await user.paste(
		typeof edited === "string" ? edited : JSON.stringify(edited, null, 2)
	);
	return user;
}

async function applyDocument(edited: Doc): Promise<void> {
	const user = await typeDocument(edited);
	await waitFor(() => {
		expect(screen.getByRole("button", { name: APPLY_PATTERN })).toBeEnabled();
	}, WAIT);
	await user.click(screen.getByRole("button", { name: APPLY_PATTERN }));
	await waitFor(() => {
		expect(useHistoryStore.getState().undoStack).toHaveLength(1);
	}, WAIT);
}

function batchBody() {
	const batch = fetchMock.mock.calls.find(([url]) =>
		String(url).endsWith("/batch")
	);
	return batch ? JSON.parse((batch[1] as RequestInit).body as string) : null;
}

function recordedCommand(): HistoryCommand {
	const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
	if (!command) {
		throw new Error("The JSON editor recorded nothing");
	}
	return command;
}

async function replayBody(
	replay: (command: HistoryCommand) => Promise<void>,
	command: HistoryCommand
): Promise<Record<string, unknown>> {
	fetchMock.mockClear();
	await replay(command);
	const call = fetchMock.mock.calls.find(
		([url]) => url === `/api/elements/${command.elementId}`
	);
	if (!call) {
		throw new Error("The replay sent no request for the element");
	}
	return JSON.parse((call[1] as RequestInit).body as string);
}

describe("marking a name as a variable in the JSON editor", () => {
	beforeEach(() => {
		served = docWith([PLAIN]);
	});

	it("sends the entry with the flag to the batch route", async () => {
		await applyDocument(docWith([VARIABLE]));

		expect(batchBody().changes).toEqual([
			{ type: "update", elementId: ROOT_ID, data: { context: [VARIABLE] } },
		]);
	});

	it("records the entry without the flag before and with it after, and Undo and Redo send them", async () => {
		await applyDocument(docWith([VARIABLE]));
		const command = recordedCommand();

		const undo = await replayBody(applyUndo, command);
		const redo = await replayBody(applyRedo, command);

		expect(command.before?.context).toEqual([PLAIN]);
		expect(command.after?.context).toEqual([VARIABLE]);
		expect(undo.context).toEqual([PLAIN]);
		expect(redo.context).toEqual([VARIABLE]);
	});

	it("sends nothing about the context when only the text is edited", async () => {
		served = docWith([VARIABLE]);
		await applyDocument(docWith([VARIABLE], "The system is very safe"));

		expect(batchBody().changes).toEqual([
			{
				type: "update",
				elementId: ROOT_ID,
				data: { description: "The system is very safe" },
			},
		]);
	});

	it("sends nothing about the context when the same variable is written with its keys in another order", async () => {
		served = docWith([VARIABLE]);
		const reordered: Entry = {
			variable: true,
			value: "AcmeBot",
			text: "the system under test",
			name: "system",
			id: "k3f9x2m7qa",
		};
		await applyDocument(docWith([reordered], "The system is very safe"));

		expect(batchBody().changes).toEqual([
			{
				type: "update",
				elementId: ROOT_ID,
				data: { description: "The system is very safe" },
			},
		]);
	});

	it("applies a value being given to a variable with none, and Undo takes it away", async () => {
		served = docWith([UNSET]);
		await applyDocument(docWith([VARIABLE]));
		const command = recordedCommand();

		const undo = await replayBody(applyUndo, command);

		expect(batchBody()).toBeNull();
		expect(undo.context).toEqual([UNSET]);
		expect((undo.context as Entry[])[0]).not.toHaveProperty("value");
	});

	it("applies a flag of false as the flag taken off, and Undo puts it back", async () => {
		served = docWith([VARIABLE]);
		await applyDocument(docWith([{ ...PLAIN, variable: false }]));
		const command = recordedCommand();
		const sent = batchBody().changes;

		const undo = await replayBody(applyUndo, command);

		expect(sent).toHaveLength(1);
		expect(JSON.stringify(sent)).not.toContain("true");
		expect(command.after?.context).toEqual([PLAIN]);
		expect(undo.context).toEqual([VARIABLE]);
	});

	it("applies the flag being taken off, and Undo puts it back", async () => {
		served = docWith([VARIABLE]);
		await applyDocument(docWith([PLAIN]));
		const command = recordedCommand();

		const undo = await replayBody(applyUndo, command);

		expect(undo.context).toEqual([VARIABLE]);
		expect(command.after?.context).toEqual([PLAIN]);
	});
});

describe("a document the JSON editor refuses", () => {
	beforeEach(() => {
		served = docWith([PLAIN]);
	});

	async function refused(edited: Doc | string) {
		await typeDocument(edited);
		await waitFor(() => {
			expect(screen.getByText(ERRORS_PATTERN)).toBeInTheDocument();
		}, WAIT);
		expect(screen.getByRole("button", { name: APPLY_PATTERN })).toBeDisabled();
		expect(batchBody()).toBeNull();
		expect(useHistoryStore.getState().undoStack).toHaveLength(0);
	}

	it.each([
		["the string true", "true"],
		["the number one", 1],
		["null", null],
	])("does not apply a hand-written flag of %s", async (_what, flag) => {
		await refused(docWith([{ ...PLAIN, variable: flag }]));
	});

	it("does not apply a version 1.0 document that holds a variable", async () => {
		await refused(docWith([VARIABLE], "The system is safe", "1.0"));
	});

	it("does not apply a variable with a value over 500 characters", async () => {
		await refused(docWith([{ ...VARIABLE, value: "v".repeat(501) }]));
	});
});
