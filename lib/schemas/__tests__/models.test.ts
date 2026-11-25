import { describe, expect, it } from "vitest";
import {
	createConnectionSchema,
	setRolesSchema,
	updateConnectionSchema,
} from "@/lib/schemas/models";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";

const newConnection = (fields: Record<string, unknown>) => ({
	label: "Office",
	type: "OLLAMA",
	...fields,
});
const chatJob = (fields: Record<string, unknown>) => ({
	chat: { connectionId: "c1", model: "m", ...fields },
	ranking: null,
	search: null,
});

const NONE = { chat: null, ranking: null, search: null };
const JOB = { connectionId: "c1", model: "m" };

describe("control characters in labels and model names", () => {
	const BAD = ["a\u0000b", "a\tb", "a\nb", "a\u001bb", "a\u007fb"];

	it.each(BAD)("refuses %j in a new connection's label", (label) => {
		const result = createConnectionSchema.safeParse({
			label,
			type: "OLLAMA",
			baseUrl: "https://models.example",
		});

		expect(result.success).toBe(false);
	});

	it.each(BAD)("refuses %j in a changed label", (label) => {
		expect(updateConnectionSchema.safeParse({ label }).success).toBe(false);
	});

	it.each(BAD)("refuses %j in a model name, for every job", (model) => {
		for (const job of ["chat", "ranking", "search"] as const) {
			expect(
				setRolesSchema.safeParse({ ...NONE, [job]: { ...JOB, model } }).success
			).toBe(false);
		}
	});

	it("still accepts an ordinary label and model name, and ignores space at either end", () => {
		expect(
			createConnectionSchema.parse({
				label: "  Office server  ",
				type: "OLLAMA",
				baseUrl: "https://models.example",
			}).label
		).toBe("Office server");
		expect(
			setRolesSchema.parse({ ...NONE, chat: { ...JOB, model: " llama3:8b " } })
				.chat?.model
		).toBe("llama3:8b");
	});
});

describe("setRolesSchema: recheckSearch", () => {
	it("is optional, and a boolean when given", () => {
		expect(setRolesSchema.safeParse(NONE).success).toBe(true);
		expect(
			setRolesSchema.parse({ ...NONE, recheckSearch: true }).recheckSearch
		).toBe(true);
		expect(
			setRolesSchema.parse({ ...NONE, recheckSearch: false }).recheckSearch
		).toBe(false);
	});

	it.each(["true", 1, null, []])("refuses %j", (recheckSearch) => {
		expect(setRolesSchema.safeParse({ ...NONE, recheckSearch }).success).toBe(
			false
		);
	});

	it("still refuses a field it does not know", () => {
		expect(setRolesSchema.safeParse({ ...NONE, recheck: true }).success).toBe(
			false
		);
	});
});

describe("new connection: messages and limits", () => {
	const CASES: [string, Record<string, unknown>, string[]][] = [
		[
			"a label that is not text",
			{ label: 5 },
			["label: label must be a string"],
		],
		["a blank label", { label: "  " }, ["label: label is required"]],
		[
			"a label of 61 characters",
			{ label: "l".repeat(61) },
			["label: label must be at most 60 characters"],
		],
		[
			"a label with a control character",
			{ label: "a\tb" },
			["label: label must not contain control characters"],
		],
		[
			"a base address that is not text",
			{ baseUrl: 5 },
			["baseUrl: baseUrl must be a string"],
		],
		[
			"a blank base address",
			{ baseUrl: "  " },
			["baseUrl: baseUrl must not be empty"],
		],
		[
			"a base address of 501 characters",
			{ baseUrl: "u".repeat(501) },
			["baseUrl: baseUrl must be at most 500 characters"],
		],
		[
			"a key that is not text",
			{ apiKey: 5 },
			["apiKey: apiKey must be a string"],
		],
		[
			"a key of 2049 characters",
			{ apiKey: "k".repeat(2049) },
			["apiKey: apiKey must be at most 2048 characters"],
		],
		[
			"a key with a space inside",
			{ apiKey: "a b" },
			["apiKey: apiKey must contain only printable ASCII characters"],
		],
		[
			"a connection type that does not exist",
			{ type: "NOPE" },
			[
				"type: type must be one of OPENROUTER, OLLAMA, OPENAI_COMPATIBLE, ANTHROPIC, OPENAI",
			],
		],
	];

	it.each(CASES)("reports %s", (_name, fields, expected) => {
		expect(issuesOf(createConnectionSchema, newConnection(fields))).toEqual(
			expected
		);
	});

	it.each([
		["a label of 60 characters", { label: "l".repeat(60) }],
		["a base address of 500 characters", { baseUrl: "u".repeat(500) }],
		["a key of 2048 characters", { apiKey: "k".repeat(2048) }],
	])("accepts %s", (_name, fields) => {
		expect(issuesOf(createConnectionSchema, newConnection(fields))).toEqual([]);
	});

	it("refuses a key with a control character, naming that rule", () => {
		expect(
			issuesOf(createConnectionSchema, newConnection({ apiKey: "a\u0001b" }))
		).toContain("apiKey: apiKey must not contain control characters");
	});

	it("asks for a key that is not blank", () => {
		expect(
			issuesOf(createConnectionSchema, newConnection({ apiKey: " " }))
		).toContain("apiKey: apiKey must not be empty");
	});

	it("trims the base address and the key", () => {
		expect(
			outputOf(
				createConnectionSchema,
				newConnection({ baseUrl: " https://m.example ", apiKey: " key " })
			)
		).toEqual({
			label: "Office",
			type: "OLLAMA",
			baseUrl: "https://m.example",
			apiKey: "key",
		});
	});
});

describe("job settings: messages and limits", () => {
	const CASES: [string, Record<string, unknown>, string[]][] = [
		[
			"a model that is not text",
			{ model: 5 },
			["chat.model: model must be a string"],
		],
		["a blank model", { model: " " }, ["chat.model: model is required"]],
		[
			"a model of 201 characters",
			{ model: "m".repeat(201) },
			["chat.model: model must be at most 200 characters"],
		],
		[
			"a model with a control character",
			{ model: "a\nb" },
			["chat.model: model must not contain control characters"],
		],
		[
			"a connection id that is not text",
			{ connectionId: 5 },
			["chat.connectionId: connectionId must be a string"],
		],
		[
			"an empty connection id",
			{ connectionId: "" },
			["chat.connectionId: connectionId is required"],
		],
		[
			"a connection id of 101 characters",
			{ connectionId: "c".repeat(101) },
			["chat.connectionId: connectionId must be at most 100 characters"],
		],
	];

	it.each(CASES)("reports %s", (_name, fields, expected) => {
		expect(issuesOf(setRolesSchema, chatJob(fields))).toEqual(expected);
	});

	it.each([
		["a model of 200 characters", { model: "m".repeat(200) }],
		["a connection id of 100 characters", { connectionId: "c".repeat(100) }],
	])("accepts %s", (_name, fields) => {
		expect(issuesOf(setRolesSchema, chatJob(fields))).toEqual([]);
	});
});

describe("changing a connection", () => {
	it("asks for at least one field", () => {
		expect(issuesOf(updateConnectionSchema, {})).toEqual([
			": Give at least one of label, baseUrl or apiKey",
		]);
	});

	it.each([
		["label", { label: "New" }],
		["baseUrl", { baseUrl: "https://m.example" }],
		["apiKey", { apiKey: "key" }],
		["apiKey removal", { apiKey: null }],
	])("accepts a change to the %s alone", (_name, body) => {
		expect(issuesOf(updateConnectionSchema, body)).toEqual([]);
	});
});
