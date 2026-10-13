import { describe, expect, it } from "vitest";
import {
	createConnectionSchema,
	setRolesSchema,
	updateConnectionSchema,
} from "@/lib/schemas/models";

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
