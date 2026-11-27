import { describe, expect, it } from "vitest";
import { canonicalJSON } from "@/lib/health-canonical-json";

describe("canonicalJSON", () => {
	it("writes primitives as JSON does", () => {
		expect(canonicalJSON(null)).toBe("null");
		expect(canonicalJSON('a"b')).toBe('"a\\"b"');
		expect(canonicalJSON(3)).toBe("3");
		expect(canonicalJSON(false)).toBe("false");
	});

	it("sorts keys at every level of nesting", () => {
		expect(canonicalJSON({ b: 1, a: { d: 2, c: [3] } })).toBe(
			'{"a":{"c":[3],"d":2},"b":1}'
		);
	});

	it("gives the same text whatever order the keys were added in", () => {
		expect(canonicalJSON({ x: 1, y: 2 })).toBe(canonicalJSON({ y: 2, x: 1 }));
	});

	it("keeps the order of array items and separates them with commas", () => {
		expect(canonicalJSON([3, 1, 2])).toBe("[3,1,2]");
		expect(canonicalJSON([])).toBe("[]");
		expect(canonicalJSON([{ b: 1, a: 2 }, "z", null])).toBe(
			'[{"a":2,"b":1},"z",null]'
		);
	});

	it("separates object members with commas", () => {
		expect(canonicalJSON({ a: 1, b: 2, c: 3 })).toBe('{"a":1,"b":2,"c":3}');
		expect(canonicalJSON({})).toBe("{}");
	});

	it("sorts keys by code unit, so uppercase comes before lowercase", () => {
		expect(canonicalJSON({ b: 1, B: 2, a: 3, "10": 4, "9": 5 })).toBe(
			'{"10":4,"9":5,"B":2,"a":3,"b":1}'
		);
	});
});
