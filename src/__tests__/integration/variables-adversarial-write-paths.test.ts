import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeTreeDiff } from "@/lib/case/tree-diff";
import prisma from "@/lib/prisma";
import {
	type CaseExportNested,
	CaseExportNestedSchema,
} from "@/lib/schemas/case-export";
import {
	applyRedo,
	applyUndo,
	recordUpdate,
} from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	openWorld,
	postBatch,
	routeFetchToElementHandlers,
} from "../utils/placeholder-kit";
import {
	batchContext,
	exported,
	exportFile,
	getElement,
	importFile,
	MORE,
	OTHER,
	ordinaryEntry,
	postElementWithContext,
	putContext,
	ref,
	SYS,
	setContext,
	setText,
	storedContext,
	type VariableWorld,
	variableEntry,
	variableWorld,
} from "../utils/variables-kit";

/**
 * The variable flag through every way a case is written and read back: the
 * single-element routes, the batch route behind the JSON editor, the export
 * file and import, undo and redo, and the JSON editor's own checks. A flag
 * that is not exactly `true` is refused and leaves the stored case alone.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
});

const BAD_FLAGS: [string, unknown][] = [
	["false", false],
	["the string true", "true"],
	["the string false", "false"],
	["the number one", 1],
	["null", null],
	["an empty object", {}],
	["an array", [true]],
];

const HOSTILE_VALUES: [string, string][] = [
	["markup", "<img src=x onerror=alert(1)>"],
	["Markdown", "**bold** [x](https://example.test)"],
	["a reference", `{window#${OTHER}}`],
	["a closing brace", "}"],
	["an equals sign", "="],
	["a newline", "line one\nline two"],
	["a replacement pattern", "$& $1 $'"],
	["the longest allowed value", "v".repeat(500)],
];

/** A case with a strategy, a claim and evidence, where no element defines a variable yet. */
async function freshWorld(): Promise<VariableWorld> {
	const world = await variableWorld("CASE");
	await setContext(world.goalId, []);
	return world;
}

describe("the single-element routes", () => {
	it.each([
		["a value", variableEntry("AcmeBot")],
		["no value", variableEntry()],
	])("save a variable with %s and return it", async (_what, entry) => {
		const world = await freshWorld();

		const response = await putContext(world.claimId, [entry]);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.context).toEqual([entry]);
		expect(await storedContext(world.claimId)).toEqual([entry]);
		const read = await (await getElement(world.claimId)).json();
		expect(read.context).toEqual([entry]);
	});

	it("saves a variable beside plain text and an ordinary entry, each as it is", async () => {
		const world = await freshWorld();
		const context = [
			"plain",
			variableEntry("AcmeBot"),
			ordinaryEntry("5 minutes", "window", OTHER),
		];

		expect((await putContext(world.strategyId, context)).status).toBe(200);

		expect(await storedContext(world.strategyId)).toEqual(context);
	});

	it.each(
		HOSTILE_VALUES
	)("saves a value of %s exactly as it was written", async (_what, value) => {
		const world = await freshWorld();

		const response = await putContext(world.claimId, [variableEntry(value)]);

		expect(response.status).toBe(200);
		expect(await storedContext(world.claimId)).toEqual([variableEntry(value)]);
	});

	it("refuses a value over 500 characters on a variable, and keeps what was stored", async () => {
		const world = await freshWorld();
		await putContext(world.claimId, [variableEntry("kept")]);

		const response = await putContext(world.claimId, [
			variableEntry("v".repeat(501)),
		]);

		expect(response.status).toBe(400);
		expect(await storedContext(world.claimId)).toEqual([variableEntry("kept")]);
	});

	it.each(
		BAD_FLAGS
	)("refuses a flag of %s and keeps what was stored", async (_what, flag) => {
		const world = await freshWorld();
		await putContext(world.claimId, [variableEntry("kept")]);

		const response = await putContext(world.claimId, [
			{ ...variableEntry("AcmeBot"), variable: flag },
		]);

		expect(response.status).toBe(400);
		expect(await storedContext(world.claimId)).toEqual([variableEntry("kept")]);
	});

	it("refuses a stray key beside the flag", async () => {
		const world = await freshWorld();

		const response = await putContext(world.claimId, [
			{ ...variableEntry("AcmeBot"), isVariable: true },
		]);

		expect(response.status).toBe(400);
		expect(await storedContext(world.claimId)).toEqual([]);
	});

	it("stores no flag when the entry is saved without it, so unmarking sticks", async () => {
		const world = await freshWorld();
		await putContext(world.claimId, [variableEntry("AcmeBot")]);

		const plain = {
			id: SYS,
			name: "system",
			text: "the system under test",
			value: "AcmeBot",
		};
		expect((await putContext(world.claimId, [plain])).status).toBe(200);

		const [stored] = (await storedContext(world.claimId)) as Record<
			string,
			unknown
		>[];
		expect(stored).toEqual(plain);
		expect(stored).not.toHaveProperty("variable");
	});

	it("keeps the flag when only the value is given anew", async () => {
		const world = await freshWorld();
		await putContext(world.claimId, [variableEntry()]);

		await putContext(world.claimId, [variableEntry("AcmeBot")]);

		expect(await storedContext(world.claimId)).toEqual([
			variableEntry("AcmeBot"),
		]);
	});

	it("applies the name rules to a variable as to any entry: no two names alike, ignoring case", async () => {
		const world = await freshWorld();

		const response = await putContext(world.claimId, [
			variableEntry("A", "System", OTHER),
			variableEntry("B", "system", MORE),
		]);

		expect(response.status).toBe(400);
	});

	it("applies the case-wide id rule to a variable", async () => {
		const world = await variableWorld("CASE");

		// SYS is already the id of the goal's variable.
		const response = await putContext(world.claimId, [
			variableEntry("AcmeBot", "other", SYS),
		]);

		expect(response.status).toBe(400);
	});

	it("applies the name rule to a variable: a name that starts with a digit is refused", async () => {
		const world = await freshWorld();

		const response = await putContext(world.claimId, [
			variableEntry("AcmeBot", "5 minutes"),
		]);

		expect(response.status).toBe(400);
	});

	it("saves a variable on a new goal made through the create route", async () => {
		const owner = await openWorld("CASE");
		const empty = await prismaCaseWithoutElements(owner.ownerId);

		const response = await postElementWithContext(empty, [
			variableEntry("AcmeBot"),
		]);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.context).toEqual([variableEntry("AcmeBot")]);
		expect(await storedContext(body.id)).toEqual([variableEntry("AcmeBot")]);
	});

	it.each(
		BAD_FLAGS
	)("refuses a flag of %s on the create route, and creates nothing", async (_what, flag) => {
		const owner = await openWorld("CASE");
		const empty = await prismaCaseWithoutElements(owner.ownerId);

		const response = await postElementWithContext(empty, [
			{ ...variableEntry("AcmeBot"), variable: flag },
		]);

		expect(response.status).toBe(400);
		expect(
			await prisma.assuranceElement.count({ where: { caseId: empty } })
		).toBe(0);
	});

	it("leaves the text of the elements that mention a variable as it was when the value changes", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const description = `Operators test the ${ref("system", SYS)}`;
		await setText(world.claimId, { description });

		await putContext(world.goalId, [variableEntry("BetaBot")]);

		const claim = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: world.claimId },
		});
		expect(claim.description).toBe(description);
	});
});

async function prismaCaseWithoutElements(ownerId: string): Promise<string> {
	const created = await prisma.assuranceCase.create({
		data: { name: "Empty", description: "No elements", createdById: ownerId },
	});
	return created.id;
}

describe("the batch route behind the JSON editor", () => {
	it("updates a context to hold a variable, and back", async () => {
		const world = await variableWorld("CASE");

		const marked = await postBatch(world.caseId, [
			batchContext(world.claimId, [variableEntry("AcmeBot", "other", MORE)]),
		]);
		expect(marked.status).toBe(200);
		expect(await storedContext(world.claimId)).toEqual([
			variableEntry("AcmeBot", "other", MORE),
		]);

		const unmarked = await postBatch(world.caseId, [
			batchContext(world.claimId, [
				{
					id: MORE,
					name: "other",
					text: "the system under test",
					value: "AcmeBot",
				},
			]),
		]);
		expect(unmarked.status).toBe(200);
		const [stored] = (await storedContext(world.claimId)) as Record<
			string,
			unknown
		>[];
		expect(stored).not.toHaveProperty("variable");
	});

	it("creates an element that defines a variable", async () => {
		const world = await variableWorld("CASE");
		const id = randomUUID();

		const response = await postBatch(world.caseId, [
			{
				type: "create",
				elementId: id,
				parentId: world.strategyId,
				data: {
					id,
					type: "PROPERTY_CLAIM",
					name: "P2",
					description: "A new claim",
					inSandbox: false,
					context: [variableEntry("AcmeBot", "other", MORE)],
				},
			},
		]);

		expect(response.status).toBe(200);
		expect(await storedContext(id)).toEqual([
			variableEntry("AcmeBot", "other", MORE),
		]);
	});

	it.each(
		BAD_FLAGS
	)("refuses a hand-written flag of %s, and changes nothing in the batch", async (_what, flag) => {
		const world = await variableWorld("CASE");

		const response = await postBatch(world.caseId, [
			{
				type: "update",
				elementId: world.claimId,
				data: { description: "Changed by the same batch" },
			},
			batchContext(world.strategyId, [
				{ ...variableEntry("AcmeBot", "other", MORE), variable: flag },
			]),
		]);

		expect(response.status).toBe(400);
		const claim = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: world.claimId },
		});
		expect(claim.description).toBe("Operators are trained");
		expect(await storedContext(world.strategyId)).toEqual([]);
	});

	it("refuses two elements that define a variable with the same id, judged after the whole batch", async () => {
		const world = await variableWorld("CASE");

		const response = await postBatch(world.caseId, [
			batchContext(world.claimId, [variableEntry("AcmeBot", "other", SYS)]),
		]);

		expect(response.status).toBe(400);
	});

	it("lets one batch move a variable's definition from one element to another", async () => {
		const world = await variableWorld("CASE", "AcmeBot");

		const response = await postBatch(world.caseId, [
			batchContext(world.goalId, []),
			batchContext(world.strategyId, [variableEntry("AcmeBot")]),
		]);

		expect(response.status).toBe(200);
		expect(await storedContext(world.strategyId)).toEqual([
			variableEntry("AcmeBot"),
		]);
		expect(await storedContext(world.goalId)).toEqual([]);
	});
});

describe("the export file and import", () => {
	it("carry a variable, with and without a value, through a round trip", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		await setContext(world.strategyId, [
			variableEntry(undefined, "operator", MORE),
		]);
		await setText(world.claimId, {
			description: `${ref("system", SYS)} and ${ref("operator", MORE)}`,
		});
		const file = await exportFile(world.caseId);

		const response = await importFile(file);
		const body = await response.json();

		expect(response.status).toBe(200);
		const copy = await exported(world.ownerId, body.id);
		expect(copy.tree.context).toEqual([variableEntry("AcmeBot")]);
		const strategy = copy.tree.children[0];
		expect(strategy?.context).toEqual([
			variableEntry(undefined, "operator", MORE),
		]);
		expect(strategy?.children[0]?.description).toBe(
			`${ref("system", SYS)} and ${ref("operator", MORE)}`
		);
	});

	it.each(
		HOSTILE_VALUES
	)("carry a value of %s through a round trip as it was", async (_what, value) => {
		const world = await variableWorld("CASE", value);
		const file = await exportFile(world.caseId);

		const response = await importFile(file);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect((await exported(world.ownerId, body.id)).tree.context).toEqual([
			variableEntry(value),
		]);
	});

	it("keep a variable when a pattern is exported and imported as a pattern", async () => {
		const world = await variableWorld("PATTERN", "AcmeBot");
		const file = await exportFile(world.caseId);

		const response = await importFile(file);
		const body = await response.json();

		expect(response.status).toBe(200);
		const copy = await exported(world.ownerId, body.id);
		expect(copy.case.kind).toBe("PATTERN");
		expect(copy.tree.context).toEqual([variableEntry("AcmeBot")]);
	});

	it.each(
		BAD_FLAGS
	)("refuse a file with a flag of %s, and create no case", async (_what, flag) => {
		const world = await variableWorld("CASE", "AcmeBot");
		const file = await exportFile(world.caseId);
		file.tree.context = [
			{ ...variableEntry("AcmeBot"), variable: flag },
		] as never;
		const before = await prisma.assuranceCase.count();

		const response = await importFile(file);

		expect(response.status).toBe(400);
		expect(await prisma.assuranceCase.count()).toBe(before);
	});

	it("refuses a file that says version 1.0 and holds a variable", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const file = await exportFile(world.caseId);
		file.version = "1.0";
		const before = await prisma.assuranceCase.count();

		const response = await importFile(file);

		expect(response.status).toBe(400);
		expect(await prisma.assuranceCase.count()).toBe(before);
	});

	it("refuses a file in which two elements define a variable with the same id", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const file = await exportFile(world.caseId);
		const strategy = file.tree.children[0];
		if (!strategy) {
			throw new Error("no strategy");
		}
		strategy.context = [variableEntry("BetaBot")];
		const before = await prisma.assuranceCase.count();

		const response = await importFile(file);

		expect(response.status).toBe(400);
		expect(await prisma.assuranceCase.count()).toBe(before);
	});

	it("refuses a file with a variable value over 500 characters", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const file = await exportFile(world.caseId);
		file.tree.context = [variableEntry("v".repeat(501))];

		const response = await importFile(file);

		expect(response.status).toBe(400);
	});

	it("keeps an ordinary term ordinary through a round trip", async () => {
		const world = await variableWorld("CASE");
		await setContext(world.goalId, [
			ordinaryEntry("5 minutes", "window", OTHER),
		]);
		const file = await exportFile(world.caseId);

		const response = await importFile(file);
		const body = await response.json();

		const copy = await exported(world.ownerId, body.id);
		expect(copy.tree.context).toEqual([
			ordinaryEntry("5 minutes", "window", OTHER),
		]);
	});
});

describe("the JSON editor's own checks and diff", () => {
	async function edited(
		world: VariableWorld,
		change: (file: CaseExportNested) => void
	) {
		const server = await exportFile(world.caseId);
		const draft = structuredClone(server);
		change(draft);
		return { server, draft };
	}

	it("accepts a document that marks a name as a variable, and applies the difference through the batch route", async () => {
		const world = await variableWorld("CASE");
		await setContext(world.goalId, [
			{
				id: SYS,
				name: "system",
				text: "the system under test",
				value: "AcmeBot",
			},
		]);
		const { server, draft } = await edited(world, (file) => {
			file.tree.context = [variableEntry("AcmeBot")];
		});
		const parsed = CaseExportNestedSchema.safeParse(draft);
		expect(parsed.success).toBe(true);
		if (!parsed.success) {
			return;
		}

		const diff = computeTreeDiff(server, parsed.data);
		expect(diff.summary.updated).toBe(1);
		const response = await postBatch(world.caseId, diff.changes);

		expect(response.status).toBe(200);
		expect(await storedContext(world.goalId)).toEqual([
			variableEntry("AcmeBot"),
		]);
	});

	it("applies a removed flag, a changed value and a removed value", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		for (const next of [
			{
				id: SYS,
				name: "system",
				text: "the system under test",
				value: "AcmeBot",
			},
			variableEntry("BetaBot"),
			variableEntry(),
		]) {
			const { server, draft } = await edited(world, (file) => {
				file.tree.context = [next];
			});
			const parsed = CaseExportNestedSchema.parse(draft);
			const diff = computeTreeDiff(server, parsed);
			expect(diff.changes).toHaveLength(1);

			const response = await postBatch(world.caseId, diff.changes);

			expect(response.status).toBe(200);
			expect(await storedContext(world.goalId)).toEqual([next]);
		}
	});

	it("sees no difference in a document that is the export, unchanged", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const server = await exportFile(world.caseId);
		const parsed = CaseExportNestedSchema.parse(structuredClone(server));

		expect(computeTreeDiff(server, parsed).changes).toEqual([]);
	});

	it.each(
		BAD_FLAGS
	)("refuses a document with a hand-written flag of %s", async (_what, flag) => {
		const world = await variableWorld("CASE", "AcmeBot");
		const { draft } = await edited(world, (file) => {
			file.tree.context = [
				{ ...variableEntry("AcmeBot"), variable: flag },
			] as never;
		});

		expect(CaseExportNestedSchema.safeParse(draft).success).toBe(false);
	});

	it("refuses a document that says 1.0 and holds a variable", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const { draft } = await edited(world, (file) => {
			file.version = "1.0";
		});

		const parsed = CaseExportNestedSchema.safeParse(draft);

		expect(parsed.success).toBe(false);
	});

	it("accepts a 1.0 document that holds no variable and no named entry", async () => {
		const world = await openWorld("CASE");
		const file = await exportFile(world.caseId);

		expect(file.version).toBe("1.0");
		expect(CaseExportNestedSchema.safeParse(file).success).toBe(true);
	});

	it("applies a document that adds a second variable beside the first", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		const { server, draft } = await edited(world, (file) => {
			file.tree.context = [
				variableEntry("AcmeBot"),
				variableEntry("Ops", "operator", MORE),
			];
		});
		const diff = computeTreeDiff(server, CaseExportNestedSchema.parse(draft));

		const response = await postBatch(world.caseId, diff.changes);

		expect(response.status).toBe(200);
		expect(await storedContext(world.goalId)).toEqual([
			variableEntry("AcmeBot"),
			variableEntry("Ops", "operator", MORE),
		]);
	});
});

describe("undo and redo through the routes", () => {
	async function editWithHistory(
		world: VariableWorld,
		before: unknown[],
		after: unknown[]
	) {
		const element = {
			id: world.claimId,
			type: "property",
			name: "P1",
			description: "Operators are trained",
		};
		await setContext(world.claimId, before);
		const saved = await putContext(world.claimId, after);
		if (saved.status !== 200) {
			throw new Error(`The edit failed with ${saved.status}`);
		}
		recordUpdate(
			world.claimId,
			"property",
			{ ...element, context: before },
			{ ...element, context: after }
		);
		const command = useHistoryStore.getState().undoStack[0]?.commands[0];
		if (!command) {
			throw new Error("no command was recorded");
		}
		routeFetchToElementHandlers();
		return command;
	}

	it("undoes marking a name as a variable and redoes it", async () => {
		const world = await variableWorld("CASE");
		const plain = {
			id: MORE,
			name: "operator",
			text: "who runs it",
			value: "Ops",
		};
		const command = await editWithHistory(
			world,
			[plain],
			[{ ...plain, variable: true }]
		);
		expect(await storedContext(world.claimId)).toEqual([
			{ ...plain, variable: true },
		]);

		await applyUndo(command);
		expect(await storedContext(world.claimId)).toEqual([plain]);

		await applyRedo(command);
		expect(await storedContext(world.claimId)).toEqual([
			{ ...plain, variable: true },
		]);
	});

	it("undoes giving a value, and redoes it, keeping the flag throughout", async () => {
		const world = await variableWorld("CASE");
		const unset = variableEntry(undefined, "operator", MORE);
		const set = variableEntry("Ops", "operator", MORE);
		const command = await editWithHistory(world, [unset], [set]);

		await applyUndo(command);
		expect(await storedContext(world.claimId)).toEqual([unset]);
		await applyRedo(command);
		expect(await storedContext(world.claimId)).toEqual([set]);
	});

	it("undoes and redoes a hostile value exactly", async () => {
		const world = await variableWorld("CASE");
		const value = `<b>x</b> {window#${OTHER}} } =\nend`;
		const before = variableEntry(value, "operator", MORE);
		const after = variableEntry("Ops", "operator", MORE);
		const command = await editWithHistory(world, [before], [after]);

		await applyUndo(command);
		expect(await storedContext(world.claimId)).toEqual([before]);
	});

	it("undoes unmarking a variable by marking it again", async () => {
		const world = await variableWorld("CASE");
		const marked = variableEntry("Ops", "operator", MORE);
		const plain = {
			id: MORE,
			name: "operator",
			text: "the system under test",
			value: "Ops",
		};
		const command = await editWithHistory(world, [marked], [plain]);

		await applyUndo(command);
		expect(await storedContext(world.claimId)).toEqual([marked]);
	});
});
