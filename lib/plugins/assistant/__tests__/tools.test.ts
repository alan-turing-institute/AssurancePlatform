import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import { exportCase } from "@/lib/services/case-export-service";
import { captureLogs } from "@/src/__tests__/helpers/capture-logs";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));

const TREE = {
	id: "g1",
	type: "GOAL",
	name: "G1",
	description: "top",
	children: [
		{
			id: "p1",
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "claim",
			children: [
				{
					id: "e1",
					type: "EVIDENCE",
					name: "E1",
					description: "ev",
					children: [],
				},
			],
		},
	],
};

const options = { toolCallId: "t", messages: [] };

beforeEach(() => {
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree,
		},
	});
});

const tree = TREE as never;

describe("assistant tools", () => {
	it("asks the export for no comments", async () => {
		await createCaseTools("u", "c").read_case.execute?.({}, options);

		expect(exportCase).toHaveBeenCalledWith("u", "c", {
			includeComments: false,
		});
	});

	it("finds a nested element and returns one level of children", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "p1" },
			options
		);

		expect(result).toMatchObject({
			found: true,
			element: { id: "p1", children: [{ id: "e1", childCount: 0 }] },
		});
	});

	it("accepts an element's label when no id matches, as a model often passes the name it sees", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: " p1 " },
			options
		);

		expect(result).toMatchObject({
			found: true,
			element: { id: "p1", children: [{ id: "e1" }] },
		});
	});

	it("prefers an id to a label, and does not guess when two elements share a label", async () => {
		const twin = {
			...TREE,
			children: [
				{ id: "p1", type: "PROPERTY_CLAIM", name: "P2", children: [] },
				{ id: "p2", type: "PROPERTY_CLAIM", name: "P1", children: [] },
				{ id: "p3", type: "PROPERTY_CLAIM", name: "P1", children: [] },
			],
		};
		vi.mocked(exportCase).mockResolvedValue({
			data: {
				version: "1.0",
				exportedAt: new Date().toISOString(),
				case: { name: "Case", description: "d" },
				tree: twin as never,
			},
		});
		const tools = createCaseTools("u", "c");

		expect(
			await tools.read_element.execute?.({ elementId: "p2" }, options)
		).toMatchObject({ found: true, element: { id: "p2" } });
		expect(
			await tools.read_element.execute?.({ elementId: "P1" }, options)
		).toMatchObject({ found: false });
	});

	it("reports an unknown id as not found", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "elsewhere" },
			options
		);

		expect(result).toMatchObject({ found: false });
	});

	it("reports not found when the export is refused", async () => {
		vi.mocked(exportCase).mockResolvedValue({ error: "Permission denied" });

		const result = await createCaseTools("u", "c").read_case.execute?.(
			{},
			options
		);

		expect(result).toMatchObject({ found: false });
	});

	describe("elements without children or a label", () => {
		const BARE = {
			id: "g1",
			type: "GOAL",
			name: "G1",
			description: "top",
			children: [
				{ id: "s1", type: "STRATEGY", name: null, description: "bare" },
				{
					id: "p1",
					type: "PROPERTY_CLAIM",
					name: "  P1  ",
					description: "claim",
					children: [
						{ id: "e1", type: "EVIDENCE", name: "E1", description: "a" },
						{
							id: "e2",
							type: "EVIDENCE",
							name: "E2",
							description: "b",
							children: [
								{ id: "x1", type: "CONTEXT", name: "X1", description: "c" },
								{ id: "x2", type: "CONTEXT", name: "X2", description: "d" },
							],
						},
					],
				},
			],
		};

		const readElement = async (elementId: string) => {
			vi.mocked(exportCase).mockResolvedValue({
				data: {
					version: "1.0",
					exportedAt: new Date().toISOString(),
					case: { name: "Case", description: "d" },
					tree: BARE as never,
				},
			});
			return await createCaseTools("u", "c").read_element.execute?.(
				{ elementId },
				options
			);
		};

		it("finds an element by its label when the label has spaces around it and another element has no label", async () => {
			expect(await readElement("p1")).toMatchObject({ found: true });
			expect(await readElement("p1 ")).toMatchObject({
				found: true,
				element: { id: "p1" },
			});
			expect(await readElement("P1")).toMatchObject({
				found: true,
				element: { id: "p1" },
			});
		});

		it("gives the same answer for an id that is not in the case as for an export that is refused", async () => {
			const unknown = await readElement("elsewhere");
			vi.mocked(exportCase).mockResolvedValue({ error: "Denied" });
			const refused = await createCaseTools("u", "c").read_case.execute?.(
				{},
				options
			);
			const logs = captureLogs();
			vi.mocked(exportCase).mockRejectedValue(new TypeError("down"));
			let unreadable: unknown;
			try {
				unreadable = await createCaseTools("u", "c").read_case.execute?.(
					{},
					options
				);
			} finally {
				logs.restore();
			}

			expect(unknown).toMatchObject({ found: false });
			expect(refused).toStrictEqual(unknown);
			expect(unreadable).not.toStrictEqual(unknown);
		});

		it("lists no children for an element that has none, and counts the children of each child", async () => {
			expect(await readElement("s1")).toMatchObject({
				found: true,
				element: { id: "s1", children: [] },
			});
			expect(await readElement("p1")).toMatchObject({
				element: {
					children: [
						{ id: "e1", childCount: 0 },
						{ id: "e2", childCount: 2 },
					],
				},
			});
		});
	});

	describe("when the case cannot be read", () => {
		const FAILURE = "connect ECONNREFUSED db.internal.example:5432";
		type Tools = ReturnType<typeof createCaseTools>;
		const READS: [string, (tools: Tools) => Promise<unknown>][] = [
			[
				"read_case",
				async (tools) => await tools.read_case.execute?.({}, options),
			],
			[
				"read_element",
				async (tools) =>
					await tools.read_element.execute?.({ elementId: "p1" }, options),
			],
			[
				"lint_case",
				async (tools) => await tools.lint_case.execute?.({}, options),
			],
		];

		it.each(
			READS
		)("%s gives a fixed result, never the error's message, and logs only its class", async (name, read) => {
			const logs = captureLogs();
			vi.mocked(exportCase).mockRejectedValue(new TypeError(FAILURE));

			let result: unknown;
			try {
				result = await read(createCaseTools("u", "c"));
			} finally {
				logs.restore();
			}

			expect(result).toEqual({
				found: false,
				message: "The case could not be read.",
			});
			expect(logs.entries).toHaveLength(1);
			expect(logs.entries[0]).toMatchObject({
				level: "warn",
				tool: name,
				errorName: "TypeError",
			});
			expect(JSON.stringify(logs.entries)).not.toContain("db.internal");
		});

		it.each([
			["suggest_edit", { elementId: "p1", description: "New" }],
			[
				"suggest_new_element",
				{ parentId: "g1", type: "strategy", description: "New" },
			],
		] as const)("%s refuses, with a reason that is not the not-found one, when the export is refused", async (name, input) => {
			const tools = createCaseTools("u", "c", { suggestions: true });
			const unknownElement = await tools[name]?.execute?.(
				{
					...input,
					...(name === "suggest_edit"
						? { elementId: "zz" }
						: { parentId: "zz" }),
				} as never,
				options
			);
			vi.mocked(exportCase).mockResolvedValue({ error: "Permission denied" });

			const result = await createCaseTools("u", "c", {
				suggestions: true,
			})[name]?.execute?.(input as never, options);

			expect(result).toMatchObject({ suggested: false });
			expect(result).not.toStrictEqual(unknownElement);
			expect((result as { reason: string }).reason.length).toBeGreaterThan(0);
		});

		it("read_case still gives the fixed result when the error's name cannot be read", async () => {
			const logs = captureLogs();
			const thrown = new Error(FAILURE);
			Object.defineProperty(thrown, "name", {
				get() {
					throw new Error(`${FAILURE} (name)`);
				},
			});
			vi.mocked(exportCase).mockRejectedValue(thrown);

			let result: unknown;
			try {
				result = await createCaseTools("u", "c").read_case.execute?.(
					{},
					options
				);
			} finally {
				logs.restore();
			}

			expect(result).toEqual({
				found: false,
				message: "The case could not be read.",
			});
			expect(logs.entries).toHaveLength(1);
			expect(logs.entries[0]).toMatchObject({
				tool: "read_case",
				errorName: "unknown",
			});
			expect(JSON.stringify(logs.entries)).not.toContain("db.internal");
		});
	});
});

describe("assistant tools: what each tool accepts", () => {
	interface Schema {
		safeParse: (input: unknown) => { data?: unknown; success: boolean };
	}
	const schemaOf = (tool: { inputSchema?: unknown } | undefined) =>
		tool?.inputSchema as Schema;
	const buildTools = () => createCaseTools("u", "c", { suggestions: true });

	it.each([
		[
			"suggest_edit",
			{
				elementId: "p1",
				description: "d",
				assumption: "a",
				justification: "j",
				context: ["c1", "c2"],
			},
			{ description: "d" },
		],
		[
			"suggest_new_element",
			{ parentId: "g1", type: "strategy", description: "d" },
			{ type: "strategy", description: "d" },
		],
		["read_element", { elementId: "p1" }, {}],
	] as const)("%s keeps every field it is given and needs its element", (name, input, withoutElement) => {
		const schema = schemaOf(buildTools()[name]);

		expect(schema.safeParse(input)).toStrictEqual({
			success: true,
			data: input,
		});
		expect(schema.safeParse(withoutElement).success).toBe(false);
	});

	it("takes no input to read the case or lint it", () => {
		const tools = buildTools();
		expect(schemaOf(tools.read_case).safeParse({}).success).toBe(true);
		expect(schemaOf(tools.lint_case).safeParse({}).success).toBe(true);
	});
});
