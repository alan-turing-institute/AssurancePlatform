import { describe, expect, it } from "vitest";
import { errorClassName } from "../error-class-name";

describe("errorClassName", () => {
	it("gives the name of an ordinary error", () => {
		expect(errorClassName(new TypeError("boom"))).toBe("TypeError");
	});

	it("gives a custom name", () => {
		class DriverFailure extends Error {
			constructor() {
				super("boom");
				this.name = "DriverFailure";
			}
		}

		expect(errorClassName(new DriverFailure())).toBe("DriverFailure");
	});

	it("gives unknown when reading the name throws", () => {
		const error = new Error("boom");
		Object.defineProperty(error, "name", {
			get() {
				throw new Error("name is not readable");
			},
		});

		expect(errorClassName(error)).toBe("unknown");
	});

	it("gives unknown for a proxy whose prototype cannot be read", () => {
		const proxy = new Proxy(new Error("boom"), {
			getPrototypeOf() {
				throw new Error("prototype is not readable");
			},
		});

		expect(errorClassName(proxy)).toBe("unknown");
	});

	it.each([
		["holds a space", "connect ECONNREFUSED db.internal"],
		["holds a line break", "Name\nsecond line"],
		["starts with a digit", "5432Error"],
		["is empty", ""],
		["is 65 characters long", "E".repeat(65)],
	])("gives unknown when the name %s", (_label, name) => {
		const error = new Error("boom");
		error.name = name;

		expect(errorClassName(error)).toBe("unknown");
	});

	it("gives a name of 64 characters", () => {
		const error = new Error("boom");
		error.name = "E".repeat(64);

		expect(errorClassName(error)).toBe(error.name);
	});

	it("gives unknown when the name is not text", () => {
		const error = new Error("boom");
		Object.defineProperty(error, "name", { value: 5432 });

		expect(errorClassName(error)).toBe("unknown");
	});

	it.each([
		["a string", "connect ECONNREFUSED db.internal"],
		["null", null],
		["undefined", undefined],
		["a number", 5432],
		["an object with a name", { name: "TypeError" }],
	])("gives unknown for %s", (_label, thrown) => {
		expect(errorClassName(thrown)).toBe("unknown");
	});
});
