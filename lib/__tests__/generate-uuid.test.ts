import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUuid } from "../generate-uuid";

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUuid", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns a UUID v4-shaped string via crypto.randomUUID", () => {
		expect(generateUuid()).toMatch(UUID_V4_REGEX);
	});

	it("falls back to crypto.getRandomValues when randomUUID is absent (insecure context)", () => {
		vi.stubGlobal("crypto", {
			getRandomValues: (arr: Uint8Array) => {
				for (let i = 0; i < arr.length; i++) {
					arr[i] = Math.floor(Math.random() * 256);
				}
				return arr;
			},
		});

		expect(generateUuid()).toMatch(UUID_V4_REGEX);
	});

	it("falls back to Math.random when crypto is entirely unavailable", () => {
		vi.stubGlobal("crypto", undefined);

		expect(generateUuid()).toMatch(UUID_V4_REGEX);
	});

	it("generates unique ids across repeated calls", () => {
		const ids = new Set(Array.from({ length: 200 }, () => generateUuid()));
		expect(ids.size).toBe(200);
	});
});
