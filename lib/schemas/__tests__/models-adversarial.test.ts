import { describe, expect, it } from "vitest";
import {
	createConnectionSchema,
	quickSetupSchema,
	setRolesSchema,
	updateConnectionSchema,
} from "@/lib/schemas/models";

const VALID_KEY = "sk-or-v1-abcdef0123456789";

/** Characters a key must never hold, with a name for each. */
const BAD_CHARACTERS: [string, string][] = [
	["NUL", "\u0000"],
	["bell", "\u0007"],
	["backspace", "\u0008"],
	["tab", "\t"],
	["line feed", "\n"],
	["vertical tab", "\u000b"],
	["form feed", "\u000c"],
	["carriage return", "\r"],
	["escape", "\u001b"],
	["unit separator", "\u001f"],
	["space", " "],
	["delete", "\u007f"],
	["next line (C1)", "\u0085"],
	["C1 control", "\u0080"],
	["no-break space", " "],
	["e acute", "é"],
	["last Latin-1 letter", "ÿ"],
	["first character above Latin-1", "Ā"],
	["Greek letter", "λ"],
	["Chinese character", "日"],
	["emoji", "😀"],
	["zero-width space", "​"],
	["zero-width joiner", "‍"],
	["byte order mark", "﻿"],
	["left-to-right override", "‭"],
	["right-to-left override", "‮"],
	["line separator", " "],
	["paragraph separator", " "],
	["full-width letter", "ｋ"],
	["Unicode tag character", "\u{e0041}"],
	["lone surrogate", "\ud800"],
];

describe("an API key is printable ASCII, wherever it is accepted", () => {
	const wherever: [string, (key: string) => unknown][] = [
		[
			"adding a connection",
			(apiKey) =>
				createConnectionSchema.safeParse({
					label: "L",
					type: "OPENROUTER",
					apiKey,
				}),
		],
		[
			"changing a connection",
			(apiKey) => updateConnectionSchema.safeParse({ apiKey }),
		],
		[
			"quick setup",
			(openRouterKey) => quickSetupSchema.safeParse({ openRouterKey }),
		],
	];

	it.each(wherever)("accepts a plain key when %s", (_where, parse) => {
		expect((parse(VALID_KEY) as { success: boolean }).success).toBe(true);
	});

	for (const [where, parse] of wherever) {
		it.each(
			BAD_CHARACTERS
		)(`refuses ${where} with a key holding a %s inside`, (_name, character) => {
			expect(
				(parse(`sk-${character}-tail`) as { success: boolean }).success
			).toBe(false);
			// At either end, a character that trimming removes leaves a clean key;
			// any other is still refused.
			const trimmedAway = character.trim() === "";
			expect(
				(parse(`${character}${VALID_KEY}${character}`) as { success: boolean })
					.success
			).toBe(trimmedAway);
		});
	}

	it("trims whitespace at the ends of a key, and keeps the key itself", () => {
		const parsed = quickSetupSchema.parse({
			openRouterKey: `  \n${VALID_KEY}\t `,
		});
		expect(parsed.openRouterKey).toBe(VALID_KEY);
	});

	it("refuses an empty key, a key of only whitespace, and a key that is not text", () => {
		for (const key of [
			"",
			"   ",
			"\n\t",
			0,
			null,
			undefined,
			[VALID_KEY],
			{ a: 1 },
			true,
		]) {
			expect(quickSetupSchema.safeParse({ openRouterKey: key }).success).toBe(
				false
			);
		}
	});

	it("accepts a key of 2048 characters and refuses one of 2049", () => {
		expect(
			quickSetupSchema.safeParse({ openRouterKey: "a".repeat(2048) }).success
		).toBe(true);
		expect(
			quickSetupSchema.safeParse({ openRouterKey: "a".repeat(2049) }).success
		).toBe(false);
	});

	it("lets a change remove a key with null, and refuses a key of another type", () => {
		expect(updateConnectionSchema.safeParse({ apiKey: null }).success).toBe(
			true
		);
		for (const apiKey of [false, 0, [], {}]) {
			expect(updateConnectionSchema.safeParse({ apiKey }).success).toBe(false);
		}
	});
});

describe("request bodies take only the fields they name", () => {
	it("refuses an extra field when adding a connection, including one that names a user", () => {
		for (const extra of [
			{ userId: "someone-else" },
			{ id: "chosen-id" },
			{ apiKeyEncrypted: "v1:forged" },
			{ createdAt: "2020-01-01" },
			{ isAdmin: true },
		]) {
			expect(
				createConnectionSchema.safeParse({
					label: "L",
					type: "OLLAMA",
					baseUrl: "http://localhost:11434",
					...extra,
				}).success
			).toBe(false);
		}
	});

	it("refuses a polluted prototype key in any body", () => {
		const polluted = JSON.parse(
			'{"__proto__": {"userId": "x"}, "openRouterKey": "k"}'
		);
		expect(quickSetupSchema.safeParse(polluted).success).toBe(false);
		const roles = JSON.parse(
			'{"__proto__": {}, "chat": null, "ranking": null, "search": null}'
		);
		expect(setRolesSchema.safeParse(roles).success).toBe(false);
	});

	it("refuses a connection of an unknown type, however it is written", () => {
		for (const type of [
			"openrouter",
			"Ollama",
			"openai",
			"GEMINI",
			"",
			"OLLAMA ",
			1,
			null,
		]) {
			expect(
				createConnectionSchema.safeParse({
					label: "L",
					type,
					baseUrl: "http://localhost:11434",
				}).success
			).toBe(false);
		}
	});

	it("refuses an empty change", () => {
		expect(updateConnectionSchema.safeParse({}).success).toBe(false);
	});

	it("refuses a change that tries to move the connection to another type or user", () => {
		expect(updateConnectionSchema.safeParse({ type: "OLLAMA" }).success).toBe(
			false
		);
		expect(
			updateConnectionSchema.safeParse({ userId: "x", label: "L" }).success
		).toBe(false);
	});

	it("requires all three jobs, and refuses a job with extra fields", () => {
		const job = { connectionId: "c", model: "m" };
		expect(setRolesSchema.safeParse({ chat: job, ranking: null }).success).toBe(
			false
		);
		expect(
			setRolesSchema.safeParse({ chat: job, ranking: null, search: null })
				.success
		).toBe(true);
		expect(
			setRolesSchema.safeParse({
				chat: { ...job, userId: "x" },
				ranking: null,
				search: null,
			}).success
		).toBe(false);
		expect(
			setRolesSchema.safeParse({
				chat: { ...job, apiKey: "k" },
				ranking: null,
				search: null,
			}).success
		).toBe(false);
	});

	it("refuses a job with a missing or empty connection or model", () => {
		for (const chat of [
			{ connectionId: "", model: "m" },
			{ connectionId: "c", model: "" },
			{ connectionId: "c", model: "   " },
			{ connectionId: "c" },
			{ model: "m" },
			{ connectionId: 1, model: "m" },
			{ connectionId: "c", model: ["m"] },
			"c",
			[],
		]) {
			expect(
				setRolesSchema.safeParse({ chat, ranking: null, search: null }).success
			).toBe(false);
		}
	});

	it("cuts nothing silently: a label or model past its limit is refused", () => {
		expect(
			createConnectionSchema.safeParse({
				label: "x".repeat(61),
				type: "ANTHROPIC",
				apiKey: VALID_KEY,
			}).success
		).toBe(false);
		expect(
			setRolesSchema.safeParse({
				chat: { connectionId: "c", model: "m".repeat(201) },
				ranking: null,
				search: null,
			}).success
		).toBe(false);
		expect(
			createConnectionSchema.safeParse({
				label: "L",
				type: "OLLAMA",
				baseUrl: `http://${"h".repeat(500)}`,
			}).success
		).toBe(false);
	});
});
