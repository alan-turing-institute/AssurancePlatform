import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import type { HistoryCommand } from "@/types/history";
import JsonViewPanel from "../json-view-panel";

// The repo-wide Radix Dialog mock does not implement the real primitive's
// behaviour; the panel is mounted the way the other panel tests mount it.
vi.unmock("@radix-ui/react-dialog");

const ROOT_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const HINT = "Describe your top-level assurance goal";
const APPLY_PATTERN = /^Apply$/;
const SLOW_WAIT_MS = 5000;

type Kind = "CASE" | "PATTERN";

interface DocNode {
	children: DocNode[];
	description: string;
	id: string;
	inSandbox: boolean;
	isPlaceholder?: boolean;
	name: string;
	placeholderHint?: string;
	type: string;
}

interface Doc {
	case: { description: string; kind: Kind; name: string };
	exportedAt: string;
	tree: DocNode;
	version: "1.1";
}

function docFor(kind: Kind, tree: DocNode): Doc {
	return {
		version: "1.1",
		exportedAt: "2026-11-02T10:00:00.000Z",
		case: { name: "Test", description: "A case", kind },
		tree,
	};
}

/** The top-level goal as a blank start leaves it: a placeholder with a hint. */
function placeholderGoal(description = ""): DocNode {
	return {
		id: ROOT_ID,
		type: "GOAL",
		name: "G1",
		description,
		isPlaceholder: true,
		placeholderHint: HINT,
		inSandbox: false,
		children: [],
	};
}

/** A goal that is not a placeholder. */
function plainGoal(description: string, children: DocNode[] = []): DocNode {
	return {
		id: ROOT_ID,
		type: "GOAL",
		name: "G1",
		description,
		inSandbox: false,
		children,
	};
}

function claim(markers: Partial<DocNode> = {}): DocNode {
	return {
		id: CLAIM_ID,
		type: "PROPERTY_CLAIM",
		name: "P1",
		description: "Operators are trained",
		inSandbox: false,
		children: [],
		...markers,
	};
}

let served: Doc = docFor("CASE", placeholderGoal());

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

function showCase(kind: Kind): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			kind,
		},
	});
}

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
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Opens the JSON editor on `served`, replaces its text with `edited` and applies it. */
async function applyEditedDocument(edited: Doc): Promise<void> {
	const user = userEvent.setup();
	render(<JsonViewPanel isOpen={true} onClose={vi.fn()} />);
	const content = await waitFor(() => {
		const element = document.querySelector(".cm-content");
		expect(element?.textContent).toContain("G1");
		return element as HTMLElement;
	});

	await user.click(content);
	await user.keyboard("{Control>}a{/Control}");
	// Paste, not keyboard(): the text is full of braces.
	await user.paste(JSON.stringify(edited, null, 2));
	// Apply enables once the debounced validation has run, and the entry is
	// recorded once the batch request has answered: both can outlast the
	// default wait on a slow machine.
	await waitFor(
		() => {
			expect(screen.getByRole("button", { name: APPLY_PATTERN })).toBeEnabled();
		},
		{ timeout: SLOW_WAIT_MS }
	);
	await user.click(screen.getByRole("button", { name: APPLY_PATTERN }));
	await waitFor(
		() => {
			expect(useHistoryStore.getState().undoStack).toHaveLength(1);
		},
		{ timeout: SLOW_WAIT_MS }
	);
}

function recordedCommand(elementId = ROOT_ID): HistoryCommand {
	const entry = useHistoryStore.getState().undoStack.at(-1);
	const command = entry?.commands.find((c) => c.elementId === elementId);
	if (!command) {
		throw new Error("The JSON editor recorded nothing for that element");
	}
	return command;
}

/** The body of the request that replays `command` against its element. */
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

describe("the JSON editor's history for a placeholder goal in a case", () => {
	beforeEach(() => {
		served = docFor("CASE", placeholderGoal());
		showCase("CASE");
	});

	const written = () => docFor("CASE", placeholderGoal("The system is safe"));

	it("sends only the text to the batch route, leaving the marker for the server to take off", async () => {
		await applyEditedDocument(written());

		const batch = fetchMock.mock.calls.find(([url]) =>
			String(url).endsWith("/batch")
		);
		const body = JSON.parse((batch?.[1] as RequestInit).body as string);
		expect(body.changes).toEqual([
			{
				type: "update",
				elementId: ROOT_ID,
				data: { description: "The system is safe" },
			},
		]);
	});

	it("records the placeholder, with its hint and empty text, as the state before, and the marker off as the state after", async () => {
		await applyEditedDocument(written());

		const command = recordedCommand();
		expect(command.before).toMatchObject({
			description: "",
			isPlaceholder: true,
			placeholderHint: HINT,
		});
		expect(command.after).toMatchObject({
			description: "The system is safe",
			isPlaceholder: false,
		});
	});

	it("puts the marker, the hint and the empty text back on Undo", async () => {
		await applyEditedDocument(written());

		const body = await replayBody(applyUndo, recordedCommand());

		expect(body).toMatchObject({
			description: "",
			isPlaceholder: true,
			placeholderHint: HINT,
		});
	});

	it("does not send the marker back on Redo", async () => {
		await applyEditedDocument(written());

		const body = await replayBody(applyRedo, recordedCommand());

		expect(body).toMatchObject({ description: "The system is safe" });
		expect(body.isPlaceholder).not.toBe(true);
	});

	it("records the marker switched off in the document as the state after, and restores it on Undo", async () => {
		await applyEditedDocument(docFor("CASE", plainGoal("")));

		const command = recordedCommand();
		const undo = await replayBody(applyUndo, command);

		expect(command.before).toMatchObject({ isPlaceholder: true });
		expect(command.after?.isPlaceholder).not.toBe(true);
		expect(undo).toMatchObject({ isPlaceholder: true, placeholderHint: HINT });
	});
});

describe("the JSON editor's history for text written to a placeholder goal in a pattern", () => {
	it("keeps the marker on in the state after, and on Redo", async () => {
		served = docFor("PATTERN", placeholderGoal());
		showCase("PATTERN");
		await applyEditedDocument(
			docFor("PATTERN", placeholderGoal("An example goal"))
		);

		const command = recordedCommand();
		const redo = await replayBody(applyRedo, command);

		expect(command.before).toMatchObject({
			isPlaceholder: true,
			description: "",
		});
		expect(command.after).toMatchObject({
			isPlaceholder: true,
			description: "An example goal",
		});
		expect(redo).toMatchObject({ isPlaceholder: true });
	});
});

describe("the JSON editor's history for marking an element that has text", () => {
	it("records the marker as off before and on after, so Undo switches it off and Redo switches it on", async () => {
		served = docFor("CASE", plainGoal("The system is safe", [claim()]));
		showCase("CASE");
		await applyEditedDocument(
			docFor(
				"CASE",
				plainGoal("The system is safe", [
					claim({
						isPlaceholder: true,
						placeholderHint: "Check this against the audit",
					}),
				])
			)
		);

		const command = recordedCommand(CLAIM_ID);
		const undo = await replayBody(applyUndo, command);
		const redo = await replayBody(applyRedo, command);

		expect(command.before?.isPlaceholder).not.toBe(true);
		expect(command.after).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Check this against the audit",
		});
		expect(undo.isPlaceholder).not.toBe(true);
		expect(redo).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Check this against the audit",
		});
	});
});
