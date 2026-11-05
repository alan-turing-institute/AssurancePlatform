import { describe, expect, it } from "vitest";
import { seededShuffle as shuffled } from "@/src/__tests__/utils/seeded-shuffle";
import { compareElementNames, compareIdentifiers } from "../identifier-utils";

/**
 * The comparison that puts element names in a fixed order: numbers inside a
 * name compare as numbers, text compares without locale, an empty or missing
 * name comes first, and two different strings are never equal. Names are free
 * text that only import can fully control, so the order has to be total for
 * any string, not just for well-formed identifiers.
 */

const sign = (n: number) => Math.sign(n);

const LONG_DIGITS = "9".repeat(40);

/** Names the application itself writes. */
const WELL_FORMED = [
	"G1",
	"G2",
	"G10",
	"S1",
	"S2",
	"S10",
	"P1",
	"P2",
	"P10",
	"P100",
	"P1.1",
	"P1.2",
	"P1.10",
	"P2.1",
	"P10.1",
	"E1",
	"E2",
	"E10",
	"AG1",
	"AG2",
	"AG10",
	"A1",
	"A2",
	"A10",
	"M1",
	"M2",
	"Ct1",
	"CCt1",
	"CP1",
	"CP2",
	"CP10",
	"CG1",
];

/** Names that only import, the JSON editor or direct edits can produce. */
const AWKWARD: (string | null)[] = [
	null,
	"",
	" ",
	"  ",
	"\u0000",
	"a",
	"A",
	"b",
	"B",
	"Z",
	"z",
	"zebra",
	"Zebra",
	"ZEBRA",
	"apple",
	"é",
	"É",
	"é",
	"ä",
	"ß",
	"ss",
	"İ",
	"i̇",
	"ı",
	"I",
	"i",
	"K",
	"K",
	"k",
	"😀",
	"😀1",
	"😀2",
	"😀10",
	"1",
	"01",
	"001",
	"2",
	"10",
	"1.1",
	"1.2",
	"1.10",
	"-1",
	"P-1",
	"P_1",
	"P 1",
	"P  1",
	"P1 ",
	" P1",
	"p1",
	"P0",
	"P00",
	"P01",
	"P001",
	"P007",
	"P8",
	"P010",
	"P1a",
	"P1A",
	"P1b",
	"P",
	"P1.01",
	"P01.2",
	"P01.1",
	"P1.1.1",
	"P9007199254740991",
	"P9007199254740992",
	"P9007199254740993",
	"P9007199254740994",
	`P${LONG_DIGITS}`,
	`P${"9".repeat(39)}8`,
	`P${"0".repeat(30)}1`,
	`P${"0".repeat(30)}`,
	"1e3",
	"NaN",
	"constructor",
	"__proto__",
	"toString",
	"P\u0663",
	"P\u00B2",
	"a1",
	"A1b",
	"p2",
	"a2",
	"A10",
	"Ct2",
	"CT10",
	"P1.0",
	"P1.02",
	"P1.2.",
];

type Name = string | null;

const POOL: Name[] = [...WELL_FORMED, ...AWKWARD];

const PAIRS: [Name, Name][] = POOL.flatMap((a) =>
	POOL.map((b): [Name, Name] => [a, b])
);

const show = (a: Name, b: Name) =>
	`${JSON.stringify(a)} against ${JSON.stringify(b)}`;

/** A missing name and an empty one read alike. */
const sameName = (a: Name, b: Name) => (a ?? "") === (b ?? "");

const atMost = (a: Name, b: Name) => sign(compareElementNames(a, b)) <= 0;
const below = (a: Name, b: Name) => sign(compareElementNames(a, b)) < 0;

const strictSomewhere = (a: Name, b: Name, c: Name) =>
	below(a, b) || below(b, c);

/** Whether a <= b and b <= c, yet a is not <= c, or one step is strict and a is not below c. */
function breaksTransitivity(a: Name, b: Name, c: Name): boolean {
	if (!(atMost(a, b) && atMost(b, c))) {
		return false;
	}
	return !atMost(a, c) || (strictSomewhere(a, b, c) && !below(a, c));
}

function transitivityViolations(): string[] {
	const found: string[] = [];
	for (const [a, b] of PAIRS) {
		if (!atMost(a, b)) {
			continue;
		}
		for (const c of POOL) {
			if (breaksTransitivity(a, b, c)) {
				found.push(`${show(a, b)} and ${show(b, c)} but not ${show(a, c)}`);
			}
		}
	}
	return found;
}

describe("compareElementNames as an ordering of any two names", () => {
	it("is zero for a name against itself and only for identical strings", () => {
		for (const a of POOL) {
			expect(compareElementNames(a, a)).toBe(0);
		}
		for (const [a, b] of PAIRS) {
			if (!sameName(a, b)) {
				expect(compareElementNames(a, b), show(a, b)).not.toBe(0);
			}
		}
	});

	it("always returns a finite number, so a sort never reads it as unordered", () => {
		for (const [a, b] of PAIRS) {
			expect(Number.isFinite(compareElementNames(a, b))).toBe(true);
		}
	});

	it("gives opposite answers when its two arguments are swapped", () => {
		for (const [a, b] of PAIRS) {
			expect(
				sign(compareElementNames(a, b)) + sign(compareElementNames(b, a)),
				show(a, b)
			).toBe(0);
		}
	});

	it("is transitive over every triple of names", () => {
		expect(transitivityViolations().slice(0, 5)).toEqual([]);
	});

	it("sorts any permutation of the names into the same list", () => {
		const reference = [...POOL].sort(compareElementNames);
		for (let seed = 1; seed <= 25; seed++) {
			const attempt = shuffled(POOL, seed).sort(compareElementNames);
			expect(attempt.map((n) => JSON.stringify(n))).toEqual(
				reference.map((n) => JSON.stringify(n))
			);
		}
	});
});

describe("compareElementNames as natural numeric order", () => {
	function sorted(names: string[]): string[] {
		return [...names].sort(compareElementNames);
	}

	it("puts a smaller number before a larger one whatever their lengths", () => {
		expect(sorted(["P100", "P10", "P2", "P1", "P9"])).toEqual([
			"P1",
			"P2",
			"P9",
			"P10",
			"P100",
		]);
	});

	it("compares each dotted part as a number", () => {
		expect(sorted(["P1.10", "P1.2", "P1", "P2", "P1.1", "P10"])).toEqual([
			"P1",
			"P1.1",
			"P1.2",
			"P1.10",
			"P2",
			"P10",
		]);
	});

	it("keeps a name with trailing text consistent with the numbers around it", () => {
		expect(sorted(["P10", "P1a", "P2", "P10a", "P1"])).toEqual([
			"P1",
			"P1a",
			"P2",
			"P10",
			"P10a",
		]);
	});

	it("orders digit runs longer than a double can hold by their digits", () => {
		const a = "P9007199254740992";
		const b = "P9007199254740993";
		const c = "P9007199254740994";
		expect(compareElementNames(a, b)).toBeLessThan(0);
		expect(compareElementNames(b, c)).toBeLessThan(0);
		expect(compareElementNames(c, a)).toBeGreaterThan(0);
		expect(compareElementNames(`P${"9".repeat(39)}8`, `P${LONG_DIGITS}`)).toBe(
			-1
		);
		expect(compareElementNames(`P${LONG_DIGITS}`, "P9")).toBeGreaterThan(0);
	});

	it("reads leading zeros as the same number and still tells the names apart", () => {
		expect(compareElementNames("P01", "P1")).not.toBe(0);
		expect(
			sign(compareElementNames("P01", "P1")) +
				sign(compareElementNames("P1", "P01")),
			"swapping the names reverses the answer"
		).toBe(0);
		for (const same of ["P01", "P1", "P001"]) {
			expect(compareElementNames("P0", same)).toBeLessThan(0);
			expect(compareElementNames(same, "P2")).toBeLessThan(0);
		}
		expect(sorted(["P010", "P8", "P007"])).toEqual(["P007", "P8", "P010"]);
		expect(
			compareElementNames(`P${"0".repeat(30)}1`, `P${"0".repeat(30)}2`)
		).toBeLessThan(0);
		expect(compareElementNames(`P${"0".repeat(30)}1`, "P2")).toBeLessThan(0);
	});

	it("compares numbers before the spelling of the text in front of them", () => {
		expect(compareElementNames("p2", "P10")).toBeLessThan(0);
		expect(compareElementNames("a2", "A10")).toBeLessThan(0);
		expect(compareElementNames("Ct2", "CT10")).toBeLessThan(0);
		expect(compareElementNames("P10", "p2")).toBeGreaterThan(0);
		expect(sorted(["p10", "P10", "p2", "P1", "P2"])).toEqual([
			"P1",
			"P2",
			"p2",
			"P10",
			"p10",
		]);
	});

	it("reads zero-padded numbers by value before it looks at the padding", () => {
		expect(compareElementNames("P1.1", "P01.2")).toBeLessThan(0);
		expect(compareElementNames("P01.2", "P1.1")).toBeGreaterThan(0);
		expect(compareElementNames("P001.1", "P1.2")).toBeLessThan(0);
		expect(compareElementNames("P1.2", "P01.10")).toBeLessThan(0);
		expect(compareElementNames("P1.02", "P1.3")).toBeLessThan(0);
		expect(sorted(["P01.2", "P1.10", "P1.1", "P001.3", "P01.1", "P2"])).toEqual(
			["P01.1", "P1.1", "P01.2", "P001.3", "P1.10", "P2"]
		);
	});

	it("counts the runs in a name before it looks at the case of its letters", () => {
		expect(compareElementNames("a1", "A1b")).toBeLessThan(0);
		expect(compareElementNames("p1", "P1a")).toBeLessThan(0);
		expect(compareElementNames("P1a", "p1")).toBeGreaterThan(0);
		expect(compareElementNames("P1", "p1.1")).toBeLessThan(0);
	});

	it("does not let a name's text decide before a later number has been compared", () => {
		expect(compareElementNames("P1.1", "P1.2")).toBeLessThan(0);
		expect(compareElementNames("P2.1", "P10.1")).toBeLessThan(0);
		expect(compareElementNames("P1.1.1", "P1.2")).toBeLessThan(0);
		expect(compareElementNames("P1.2", "P1.1.1")).toBeGreaterThan(0);
	});
});

describe("compareElementNames as text order", () => {
	it("puts a missing or empty name before every other name", () => {
		for (const name of ["P1", "0", " ", "\u0000", "a", "!", "😀"]) {
			expect(compareElementNames(null, name)).toBeLessThan(0);
			expect(compareElementNames("", name)).toBeLessThan(0);
			expect(compareElementNames(name, null)).toBeGreaterThan(0);
			expect(compareElementNames(name, "")).toBeGreaterThan(0);
		}
	});

	it("puts a digit run before a text run", () => {
		expect(compareElementNames("0", "!")).toBeLessThan(0);
		expect(compareElementNames("9", "A")).toBeLessThan(0);
		expect(compareElementNames("1x", "x1")).toBeLessThan(0);
	});

	it("puts a shorter sequence of runs before a longer one that starts the same", () => {
		expect(compareElementNames("P1", "P1.1")).toBeLessThan(0);
		expect(compareElementNames("P1", "P1a")).toBeLessThan(0);
		expect(compareElementNames("A1", "A1.2.3")).toBeLessThan(0);
		expect(compareElementNames("P", "P1")).toBeLessThan(0);
	});

	it("compares letters without regard to case first", () => {
		expect(compareElementNames("a", "Z")).toBeLessThan(0);
		expect(compareElementNames("B", "c")).toBeLessThan(0);
		expect(compareElementNames("p10", "P2")).toBeGreaterThan(0);
		expect(compareElementNames("P1", "p2")).toBeLessThan(0);
		expect(compareElementNames("Zebra", "apple")).toBeGreaterThan(0);
	});

	it("tells names that differ only in case apart, the same way each time", () => {
		const cases = ["p1", "P1", "Ct1", "CT1", "cT1", "ct1"];
		for (const a of cases) {
			for (const b of cases) {
				if (a !== b) {
					expect(compareElementNames(a, b)).not.toBe(0);
				}
			}
		}
		const first = [...cases].sort(compareElementNames);
		expect([...cases].reverse().sort(compareElementNames)).toEqual(first);
		// letters compare without regard to case first, so each spelling stays with its own kind
		expect(first.slice(0, 4).map((name) => name.toLowerCase())).toEqual([
			"ct1",
			"ct1",
			"ct1",
			"ct1",
		]);
		expect(first.slice(4).map((name) => name.toLowerCase())).toEqual([
			"p1",
			"p1",
		]);
	});

	it("does not depend on the locale: accented letters follow plain ones by character code", () => {
		expect(compareElementNames("é1", "z1")).toBeGreaterThan(0);
		expect(compareElementNames("ä1", "z1")).toBeGreaterThan(0);
		expect(compareElementNames("e1", "é1")).toBeLessThan(0);
	});

	it("tells apart names that are canonically equivalent but not the same string", () => {
		expect(compareElementNames("é", "é")).not.toBe(0);
	});

	it("orders numbers that follow characters outside the basic plane", () => {
		expect(compareElementNames("😀2", "😀10")).toBeLessThan(0);
		expect(compareElementNames("😀", "😀1")).toBeLessThan(0);
	});

	it("keeps lower-cased text that maps to more than one character consistent", () => {
		const names = ["İ1", "i̇1", "i1", "I1", "ı1"];
		const first = [...names].sort(compareElementNames);
		for (let seed = 1; seed <= 10; seed++) {
			expect(shuffled(names, seed).sort(compareElementNames)).toEqual(first);
		}
	});
});

describe("compareElementNames against very large names", () => {
	it("compares names of a hundred thousand characters without trouble", () => {
		const a = `P${"1".repeat(100_000)}`;
		const b = `P${"1".repeat(99_999)}2`;
		const c = `P${"1".repeat(100_001)}`;
		expect(compareElementNames(a, b)).toBeLessThan(0);
		expect(compareElementNames(a, c)).toBeLessThan(0);
		expect(compareElementNames(c, b)).toBeGreaterThan(0);
		const text = "x".repeat(100_000);
		expect(compareElementNames(`${text}a`, `${text}b`)).toBeLessThan(0);
		const mixed = "a1".repeat(30_000);
		expect(compareElementNames(`${mixed}1`, `${mixed}2`)).toBeLessThan(0);
	});
});

const RUNS = /[0-9]+|[^0-9]+/g;
const STARTS_WITH_DIGIT = /^[0-9]/;
const LEADING_ZEROS = /^0+/;

const runsOf = (name: Name) => (name ?? "").match(RUNS) ?? [];

function compareCodes(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? -1 : 1;
}

function compareDigits(x: string, y: string): number {
	const left = x.replace(LEADING_ZEROS, "");
	const right = y.replace(LEADING_ZEROS, "");
	return left.length === right.length
		? compareCodes(left, right)
		: left.length - right.length;
}

function compareRunPair(x: string, y: string): number {
	const xDigits = STARTS_WITH_DIGIT.test(x);
	if (xDigits !== STARTS_WITH_DIGIT.test(y)) {
		return xDigits ? -1 : 1;
	}
	return xDigits
		? compareDigits(x, y)
		: compareCodes(x.toLowerCase(), y.toLowerCase());
}

function compareRuns(ra: string[], rb: string[]): number {
	for (let i = 0; i < Math.min(ra.length, rb.length); i++) {
		const order = compareRunPair(ra[i] as string, rb[i] as string);
		if (order !== 0) {
			return order;
		}
	}
	return ra.length - rb.length;
}

/**
 * The order written out the long way: runs of digits and runs of anything else
 * are compared run by run (digits by value, a digit run before any other run,
 * other text lower-cased and compared by character code), then the number of
 * runs, and only then the whole string by character code.
 */
function written(a: Name, b: Name): number {
	const byRuns = compareRuns(runsOf(a), runsOf(b));
	return byRuns === 0 ? compareCodes(a ?? "", b ?? "") : byRuns;
}

describe("compareElementNames against the order written out in full", () => {
	it("agrees with it for every pair of names", () => {
		const disagreements = PAIRS.filter(
			([a, b]) =>
				// a missing name and an empty one may be told apart either way
				(a === b || !sameName(a, b)) &&
				sign(written(a, b)) !== sign(compareElementNames(a, b))
		).map(([a, b]) => show(a, b));
		expect(disagreements.length, disagreements.slice(0, 8).join("\n")).toBe(0);
	});
});

describe("compareElementNames beside the order the canvas uses", () => {
	const SAME_PREFIX_PAIRS: [string, string][] = [];
	const names = WELL_FORMED;
	for (const a of names) {
		for (const b of names) {
			if (a !== b) {
				SAME_PREFIX_PAIRS.push([a, b]);
			}
		}
	}

	it("orders well-formed names as the canvas does", () => {
		const disagreements: string[] = [];
		for (const [a, b] of SAME_PREFIX_PAIRS) {
			const canvas = sign(compareIdentifiers(a, b));
			if (canvas !== 0 && canvas !== sign(compareElementNames(a, b))) {
				disagreements.push(`${a} against ${b}`);
			}
		}
		expect(disagreements).toEqual([]);
	});

	it("orders well-formed names that carry leading zeros as the canvas does", () => {
		const padded = [
			"P01",
			"P1",
			"P001",
			"P2",
			"P01.2",
			"P1.1",
			"P001.1",
			"P1.02",
			"P1.2",
			"P10",
			"P010",
		];
		const disagreements: string[] = [];
		for (const a of padded) {
			for (const b of padded) {
				const canvas = sign(compareIdentifiers(a, b));
				if (canvas !== 0 && canvas !== sign(compareElementNames(a, b))) {
					disagreements.push(
						`${a} against ${b}: canvas ${canvas}, export ${sign(compareElementNames(a, b))}`
					);
				}
			}
		}
		expect(disagreements).toEqual([]);
	});
});
