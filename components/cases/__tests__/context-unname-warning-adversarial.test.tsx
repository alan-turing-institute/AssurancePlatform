// biome-ignore-all lint/suspicious/noMisplacedAssertion: the helpers below are called from within it() blocks
import { configure, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import NodeEditDialog from "../node-edit-dialog";

// The dialogs and editors are slow to settle on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

/**
 * Removing the name of a context entry in "Edit element": the warning that
 * offers "Remove name and value" or "Keep name" must follow the value as the
 * entry stands now, whether it was typed in this visit or saved earlier.
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

const WINDOW = {
	id: "a1b2c3d4e5",
	name: "window",
	text: "the moving interval",
};
const SYSTEM = {
	id: "k3f9x2m7qa",
	name: "system",
	text: "the system under test",
};
const LIMIT = { id: "q8w7e6r5t4", name: "limit", text: "the upper bound" };
const SAVED_WINDOW = { ...WINDOW, value: "5 minutes" };
const SAVED_VARIABLE = { ...SYSTEM, value: "AcmeBot", variable: true as const };
const UNSET_VARIABLE = { ...SYSTEM, variable: true as const };

type Session = ReturnType<typeof openEditor>;

function openEditor(context: ContextEntry[]) {
	const user = userEvent.setup();
	const onOpenChange = vi.fn();
	const bodies: Record<string, unknown>[] = [];
	server.use(
		http.get("/api/user/plugins", () => HttpResponse.json({ plugins: [] })),
		http.put("/api/elements/4", async ({ request }) => {
			bodies.push((await request.json()) as Record<string, unknown>);
			return HttpResponse.json({}, { status: 200 });
		})
	);
	const node: Node = {
		id: "4",
		type: "goal",
		position: { x: 0, y: 0 },
		data: { id: 4, name: "G1", description: "System is safe", context },
	};
	render(
		<NodeEditDialog
			node={node}
			nodeType="goal"
			onOpenChange={onOpenChange}
			open={true}
		/>,
		{ withProviders: false }
	);
	const save = async () => {
		await user.click(screen.getByRole("button", { name: "Update Goal" }));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		return bodies[0]?.context;
	};
	return { save, user };
}

async function setValue(session: Session, entry: number, text: string) {
	const box = await screen.findByLabelText(`Context entry ${entry} value`);
	await session.user.clear(box);
	if (text) {
		await session.user.type(box, text);
	}
}

async function removeName(session: Session, entry: number) {
	await session.user.click(
		await screen.findByRole("button", {
			name: `Remove name of context entry ${entry}`,
		})
	);
}

function answer(session: Session, choice: string) {
	return session.user.click(screen.getByRole("button", { name: choice }));
}

function expectWarningNaming(name: string, value: string) {
	const alert = screen.getByRole("alert");
	expect(alert).toHaveTextContent(`loses its value (${value})`);
	expect(alert).toHaveTextContent(`refers to ${name}`);
	expect(
		within(alert).getByRole("button", { name: "Remove name and value" })
	).toBeInTheDocument();
	expect(
		within(alert).getByRole("button", { name: "Keep name" })
	).toBeInTheDocument();
}

function expectNoWarning() {
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Remove name and value" })
	).not.toBeInTheDocument();
}

function expectNamed(entry: number, name: string, value: string) {
	expect(screen.getByLabelText(`Context entry ${entry} name`)).toHaveValue(
		name
	);
	expect(screen.getByLabelText(`Context entry ${entry} value`)).toHaveValue(
		value
	);
}

function expectPlain(entry: number, text: string) {
	expect(screen.getByLabelText(`Context entry ${entry}`)).toHaveValue(text);
	expect(
		screen.queryByLabelText(`Context entry ${entry} name`)
	).not.toBeInTheDocument();
	expect(
		screen.queryByLabelText(`Context entry ${entry} value`)
	).not.toBeInTheDocument();
}

beforeEach(() => {
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

describe("Remove name on an entry whose value was typed in this visit", () => {
	it("warns, naming the value just typed, and leaves the entry named", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");

		await removeName(session, 1);

		expectWarningNaming("window", "5 minutes");
		expectNamed(1, "window", "5 minutes");
	});

	it("warns for an entry added, named and given a value in the same visit", async () => {
		const session = openEditor([]);
		await session.user.type(
			screen.getByPlaceholderText("Add new context..."),
			WINDOW.text
		);
		await session.user.click(screen.getByRole("button", { name: "Add" }));
		await session.user.click(
			await screen.findByRole("button", { name: "Name context entry 1" })
		);
		await session.user.type(
			screen.getByLabelText("Context entry 1 name"),
			WINDOW.name
		);
		await setValue(session, 1, "5 minutes");

		await removeName(session, 1);

		expectWarningNaming("window", "5 minutes");
	});

	it("names the name as edited after the value was typed", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");
		await session.user.type(screen.getByLabelText("Context entry 1 name"), "s");

		await removeName(session, 1);

		expectWarningNaming("windows", "5 minutes");
	});

	it("keeps the name and the value when Keep name is chosen", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");
		await removeName(session, 1);

		await answer(session, "Keep name");

		expectNoWarning();
		expectNamed(1, "window", "5 minutes");
		expect(await session.save()).toEqual([SAVED_WINDOW]);
	});

	it("turns the entry into plain text, and saves it so, when Remove name and value is chosen", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");
		await removeName(session, 1);

		await answer(session, "Remove name and value");

		expectNoWarning();
		expectPlain(1, WINDOW.text);
		expect(await session.save()).toEqual([WINDOW.text]);
	});

	it("names the last value typed after typing, clearing and typing again", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");
		await setValue(session, 1, "");
		await setValue(session, 1, "7 minutes");

		await removeName(session, 1);

		expectWarningNaming("window", "7 minutes");
	});

	it("un-names at once when the value typed was cleared again", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");
		await setValue(session, 1, "");

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, WINDOW.text);
	});
});

describe("Remove name on an entry whose value was saved earlier", () => {
	it("warns, naming the saved value", async () => {
		const session = openEditor([SAVED_WINDOW]);

		await removeName(session, 1);

		expectWarningNaming("window", "5 minutes");
		expectNamed(1, "window", "5 minutes");
	});

	it("warns with the value as edited in this visit", async () => {
		const session = openEditor([SAVED_WINDOW]);
		await setValue(session, 1, "10 minutes");

		await removeName(session, 1);

		expectWarningNaming("window", "10 minutes");
		expect(screen.getByRole("alert")).not.toHaveTextContent("5 minutes");
	});

	it("removes both the name and the saved value on confirming", async () => {
		const session = openEditor([SAVED_WINDOW]);
		await removeName(session, 1);

		await answer(session, "Remove name and value");

		expectPlain(1, WINDOW.text);
		expect(await session.save()).toEqual([WINDOW.text]);
	});

	it.each([
		["emptied", ""],
		["replaced by spaces only", "   "],
	])("un-names at once when the saved value is %s in this visit", async (_how, text) => {
		const session = openEditor([SAVED_WINDOW]);
		await setValue(session, 1, text);

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, WINDOW.text);
		expect(await session.save()).toEqual([WINDOW.text]);
	});
});

describe("Remove name on an entry with no value", () => {
	it("un-names at once when no value was ever given", async () => {
		const session = openEditor([WINDOW]);

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, WINDOW.text);
		expect(await session.save()).toEqual([WINDOW.text]);
	});

	it("un-names at once when only spaces were typed as the value", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "   ");

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, WINDOW.text);
	});
});

describe("Remove name on an entry marked as a variable", () => {
	it("warns about a value typed in this visit and removes the marker with the name", async () => {
		const session = openEditor([UNSET_VARIABLE]);
		await setValue(session, 1, "AcmeBot");

		await removeName(session, 1);
		expectWarningNaming("system", "AcmeBot");
		await answer(session, "Remove name and value");

		expectPlain(1, SYSTEM.text);
		expect(await session.save()).toEqual([SYSTEM.text]);
	});

	it("warns about a saved value and keeps the variable as it was on Keep name", async () => {
		const session = openEditor([SAVED_VARIABLE]);

		await removeName(session, 1);
		expectWarningNaming("system", "AcmeBot");
		await answer(session, "Keep name");

		expect(await session.save()).toEqual([SAVED_VARIABLE]);
	});

	it("un-names at once when the saved value is cleared in this visit", async () => {
		const session = openEditor([SAVED_VARIABLE]);
		await setValue(session, 1, "");

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, SYSTEM.text);
	});

	it("un-names at once when the variable never had a value", async () => {
		const session = openEditor([UNSET_VARIABLE]);

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, SYSTEM.text);
	});
});

describe("Remove name among several entries", () => {
	it("warns for the second entry alone when only it has a value typed", async () => {
		const session = openEditor([WINDOW, SYSTEM]);
		await setValue(session, 2, "AcmeBot");

		await removeName(session, 2);

		expectWarningNaming("system", "AcmeBot");
		expect(screen.getAllByRole("alert")).toHaveLength(1);
		expectNamed(1, "window", "");
	});

	it("un-names the first and third entries at once when only the second has a value typed", async () => {
		const session = openEditor([WINDOW, SYSTEM, LIMIT]);
		await setValue(session, 2, "AcmeBot");

		await removeName(session, 1);
		await removeName(session, 3);

		expectNoWarning();
		expectPlain(1, WINDOW.text);
		expectPlain(3, LIMIT.text);
		expectNamed(2, "system", "AcmeBot");
	});

	it("un-names the second entry at once when only the first has a value typed", async () => {
		const session = openEditor([WINDOW, SYSTEM]);
		await setValue(session, 1, "5 minutes");

		await removeName(session, 2);

		expectNoWarning();
		expectPlain(2, SYSTEM.text);
		expectNamed(1, "window", "5 minutes");
	});

	it("names the first entry's saved value after the second entry's value is edited", async () => {
		const session = openEditor([SAVED_WINDOW, SYSTEM]);
		await setValue(session, 2, "AcmeBot");

		await removeName(session, 1);

		expectWarningNaming("window", "5 minutes");
		expect(screen.getAllByRole("alert")).toHaveLength(1);
	});

	it("keeps the edited value of another entry when Keep name is chosen", async () => {
		const session = openEditor([SAVED_WINDOW, SYSTEM]);
		await setValue(session, 2, "AcmeBot");
		await removeName(session, 1);

		await answer(session, "Keep name");

		expect(await session.save()).toEqual([
			SAVED_WINDOW,
			{ ...SYSTEM, value: "AcmeBot" },
		]);
	});

	it("removes only the chosen entry's name and value, leaving a value typed on another", async () => {
		const session = openEditor([WINDOW, SYSTEM]);
		await setValue(session, 1, "5 minutes");
		await setValue(session, 2, "AcmeBot");
		await removeName(session, 1);

		await answer(session, "Remove name and value");

		expectPlain(1, WINDOW.text);
		expectNamed(2, "system", "AcmeBot");
		expect(await session.save()).toEqual([
			WINDOW.text,
			{ ...SYSTEM, value: "AcmeBot" },
		]);
	});

	it("warns on each of two entries whose values were typed in this visit", async () => {
		const session = openEditor([WINDOW, SYSTEM]);
		await setValue(session, 1, "5 minutes");
		await setValue(session, 2, "AcmeBot");

		await removeName(session, 2);
		await removeName(session, 1);

		const [first, second] = screen.getAllByRole("alert");
		expect(first).toHaveTextContent("loses its value (5 minutes)");
		expect(second).toHaveTextContent("loses its value (AcmeBot)");
	});
});

describe("Remove name after Keep name", () => {
	it("warns again, naming the value, when the name is removed a second time", async () => {
		const session = openEditor([WINDOW]);
		await setValue(session, 1, "5 minutes");
		await removeName(session, 1);
		await answer(session, "Keep name");

		await removeName(session, 1);

		expectWarningNaming("window", "5 minutes");
		await answer(session, "Remove name and value");
		expectPlain(1, WINDOW.text);
	});

	it("un-names at once when the value is cleared after Keep name", async () => {
		const session = openEditor([SAVED_WINDOW]);
		await removeName(session, 1);
		await answer(session, "Keep name");
		await setValue(session, 1, "");

		await removeName(session, 1);

		expectNoWarning();
		expectPlain(1, WINDOW.text);
	});

	it("names the changed value when the value is edited after Keep name", async () => {
		const session = openEditor([SAVED_WINDOW]);
		await removeName(session, 1);
		await answer(session, "Keep name");
		await setValue(session, 1, "10 minutes");

		await removeName(session, 1);

		expectWarningNaming("window", "10 minutes");
	});
});

describe("The warning while it is showing", () => {
	it("names the value as it is edited behind it", async () => {
		const session = openEditor([SAVED_WINDOW]);
		await removeName(session, 1);

		await setValue(session, 1, "10 minutes");

		expectWarningNaming("window", "10 minutes");
	});
});
