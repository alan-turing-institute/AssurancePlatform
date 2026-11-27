import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUuid } from "../generate-uuid";

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KNOWN_BYTES = [
	0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc,
	0xdd, 0xee, 0xff,
];

/** The known bytes with one position replaced. */
function bytesWith(index: number, value: number): number[] {
	return KNOWN_BYTES.map((byte, i) => (i === index ? value : byte));
}

function fillWith(bytes: number[]) {
	return (arr: Uint8Array) => {
		arr.set(bytes);
		return arr;
	};
}

function useGetRandomValues(bytes: number[]) {
	vi.stubGlobal("crypto", { getRandomValues: fillWith(bytes) });
}

/** Each draw is the byte divided by 256, so it scales back to exactly that byte. */
function stubRandomBytes(bytes: number[]) {
	const draws = bytes.map((byte) => byte / 256);
	vi.spyOn(Math, "random").mockImplementation(() => draws.shift() ?? 0);
}

function useMathRandom(bytes: number[]) {
	vi.stubGlobal("crypto", undefined);
	stubRandomBytes(bytes);
}

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

	describe("each source, with its input fixed", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("returns what crypto.randomUUID gives, without touching the other sources", () => {
			const getRandomValues = vi.fn();
			vi.stubGlobal("crypto", {
				randomUUID: () => "00000000-0000-4000-8000-000000000000",
				getRandomValues,
			});
			const random = vi.spyOn(Math, "random");

			expect(generateUuid()).toBe("00000000-0000-4000-8000-000000000000");
			expect(getRandomValues).not.toHaveBeenCalled();
			expect(random).not.toHaveBeenCalled();
		});

		it("builds the id from the bytes crypto.getRandomValues gives, when randomUUID is missing", () => {
			vi.stubGlobal("crypto", { getRandomValues: fillWith(KNOWN_BYTES) });
			const random = vi.spyOn(Math, "random");

			expect(generateUuid()).toBe("00112233-4455-4677-8899-aabbccddeeff");
			expect(random).not.toHaveBeenCalled();
		});

		it("asks getRandomValues for sixteen bytes", () => {
			const lengths: number[] = [];
			vi.stubGlobal("crypto", {
				getRandomValues: (arr: Uint8Array) => {
					lengths.push(arr.length);
					return fillWith(KNOWN_BYTES)(arr);
				},
			});

			generateUuid();

			expect(lengths).toStrictEqual([16]);
		});

		it("uses randomUUID only when it is a function", () => {
			vi.stubGlobal("crypto", {
				randomUUID: "not a function",
				getRandomValues: fillWith(KNOWN_BYTES),
			});

			expect(generateUuid()).toBe("00112233-4455-4677-8899-aabbccddeeff");
		});

		it("falls through to Math.random when crypto has neither generator", () => {
			vi.stubGlobal("crypto", {});
			stubRandomBytes(KNOWN_BYTES);

			expect(generateUuid()).toBe("00112233-4455-4677-8899-aabbccddeeff");
		});

		it("builds the id from Math.random scaled to bytes when crypto is unavailable", () => {
			vi.stubGlobal("crypto", undefined);
			stubRandomBytes(KNOWN_BYTES);

			expect(generateUuid()).toBe("00112233-4455-4677-8899-aabbccddeeff");
		});

		it("maps the largest and smallest Math.random draws to bytes ff and 00", () => {
			vi.stubGlobal("crypto", undefined);
			const draws = new Array<number>(16).fill(0.999_999_9);
			draws[0] = 0;
			vi.spyOn(Math, "random").mockImplementation(() => draws.shift() ?? 0);

			expect(generateUuid()).toBe("00ffffff-ffff-4fff-bfff-ffffffffffff");
		});
	});

	describe.each([
		["crypto.getRandomValues", useGetRandomValues],
		["Math.random", useMathRandom],
	])("the version and variant digits from %s", (_source, install) => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it.each(
			Array.from({ length: 16 }, (_unused, nibble) => nibble)
		)("sets the version digit to 4 and keeps the low nibble, for a version byte of %i", (low) => {
			install(bytesWith(6, 0xf0 + low));

			const id = generateUuid();

			expect(id.slice(14, 16)).toBe(`4${low.toString(16)}`);
		});

		it.each([
			[0, "8"],
			[1, "9"],
			[2, "a"],
			[3, "b"],
			[4, "8"],
			[5, "9"],
			[6, "a"],
			[7, "b"],
			[8, "8"],
			[9, "9"],
			[10, "a"],
			[11, "b"],
			[12, "8"],
			[13, "9"],
			[14, "a"],
			[15, "b"],
		])("maps a variant byte with high nibble %i to digit %s and keeps the low nibble", (high, digit) => {
			install(bytesWith(8, high * 16 + 5));

			const id = generateUuid();

			expect(id.slice(19, 21)).toBe(`${digit}5`);
			expect(id).toMatch(UUID_V4_REGEX);
		});

		it("lays the digits out as 8-4-4-4-12 with hyphens in the right places", () => {
			install(KNOWN_BYTES);

			const id = generateUuid();

			expect(id).toHaveLength(36);
			expect([8, 13, 18, 23].map((index) => id[index])).toStrictEqual([
				"-",
				"-",
				"-",
				"-",
			]);
			expect(id.replaceAll("-", "")).toBe("00112233445546778899aabbccddeeff");
		});
	});

	it("generates unique ids across repeated calls", () => {
		const ids = new Set(Array.from({ length: 200 }, () => generateUuid()));
		expect(ids.size).toBe(200);
	});
});
