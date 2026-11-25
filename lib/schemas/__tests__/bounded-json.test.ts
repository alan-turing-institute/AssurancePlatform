import { describe, expect, it } from "vitest";
import {
	BOUNDED_JSON_MAX_KEYS,
	boundedJsonValueSchema,
	serializedByteLength,
} from "../bounded-json";

const objectWithKeys = (count: number) =>
	Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, i]));

const nest = (levels: number, inner: unknown): unknown =>
	levels === 0 ? inner : [nest(levels - 1, inner)];

const nestInObjects = (levels: number, inner: unknown): unknown =>
	levels === 0 ? inner : { a: nestInObjects(levels - 1, inner) };

describe("boundedJsonValueSchema — nesting depth", () => {
	it("accepts only plain values when no nesting is allowed", () => {
		const schema = boundedJsonValueSchema(0);
		expect(schema.safeParse("text").success).toBe(true);
		expect(schema.safeParse(null).success).toBe(true);
		expect(schema.safeParse([]).success).toBe(false);
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("allows exactly as many levels of arrays as the depth", () => {
		const schema = boundedJsonValueSchema(2);
		expect(schema.safeParse(nest(2, 1)).success).toBe(true);
		expect(schema.safeParse(nest(3, 1)).success).toBe(false);
	});

	it("allows exactly as many levels of objects as the depth", () => {
		const schema = boundedJsonValueSchema(2);
		expect(schema.safeParse(nestInObjects(2, 1)).success).toBe(true);
		expect(schema.safeParse(nestInObjects(3, 1)).success).toBe(false);
	});
});

describe("boundedJsonValueSchema — object size", () => {
	const schema = boundedJsonValueSchema(1);

	it("accepts an object with the most keys allowed", () => {
		expect(
			schema.safeParse(objectWithKeys(BOUNDED_JSON_MAX_KEYS)).success
		).toBe(true);
	});

	it("refuses an object with one key more, with a message that says so", () => {
		const result = schema.safeParse(objectWithKeys(BOUNDED_JSON_MAX_KEYS + 1));
		expect(result.success).toBe(false);
		// The refusal is reported inside the union's per-branch issue lists.
		expect(JSON.stringify(result.error?.issues)).toContain(
			"Must have at most 20 keys"
		);
	});
});

describe("serializedByteLength", () => {
	it("counts the bytes of the JSON text, not its characters", () => {
		expect(serializedByteLength("é")).toBe(4);
		expect(serializedByteLength({ a: 1 })).toBe(7);
	});
});
