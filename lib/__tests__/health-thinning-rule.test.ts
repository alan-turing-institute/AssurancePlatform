import { describe, expect, it } from "vitest";
import {
	chooseRecordsToKeep,
	type ThinningRow,
} from "@/lib/health-thinning-rule";

const MINUTE_MS = 60_000;
const T0 = 1_700_000_000_000;

/** A record with a result key (or null) at a number of minutes after a fixed start. */
function at(resultKey: string | null, minutes: number): ThinningRow {
	return { resultKey, timestampMs: T0 + minutes * MINUTE_MS };
}

function keepFor(
	key: string | null,
	minutesList: readonly number[]
): boolean[] {
	return chooseRecordsToKeep(minutesList.map((minutes) => at(key, minutes)));
}

describe("chooseRecordsToKeep: small logs", () => {
	it("keeps nothing for an empty log", () => {
		expect(chooseRecordsToKeep([])).toStrictEqual([]);
	});

	it("keeps a single record, with or without a key", () => {
		expect(chooseRecordsToKeep([at("a", 0)])).toStrictEqual([true]);
		expect(chooseRecordsToKeep([at(null, 0)])).toStrictEqual([true]);
	});

	it("keeps both records of a pair with the same key", () => {
		expect(keepFor("a", [0, 1])).toStrictEqual([true, true]);
	});
});

describe("chooseRecordsToKeep: runs", () => {
	it("keeps only the first and last of a dense run", () => {
		expect(keepFor("a", [0, 1, 2, 3, 4])).toStrictEqual([
			true,
			false,
			false,
			false,
			true,
		]);
	});

	it("keeps every record that has no key, and ends the run on both sides", () => {
		expect(
			chooseRecordsToKeep([
				at("a", 0),
				at("a", 1),
				at("a", 2),
				at(null, 3),
				at("a", 4),
				at("a", 5),
				at("a", 6),
			])
		).toStrictEqual([true, false, true, true, true, false, true]);
		expect(keepFor(null, [0, 1, 2])).toStrictEqual([true, true, true]);
	});

	it("ends a run where the key changes", () => {
		expect(
			chooseRecordsToKeep([
				at("a", 0),
				at("a", 1),
				at("a", 2),
				at("b", 3),
				at("b", 4),
				at("b", 5),
			])
		).toStrictEqual([true, false, true, true, false, true]);
		expect(
			chooseRecordsToKeep([at("a", 0), at("a", 1), at("b", 2), at("b", 3)])
		).toStrictEqual([true, true, true, true]);
	});

	it("keeps the records either side of a key that comes back after another", () => {
		expect(
			chooseRecordsToKeep([
				at("a", 0),
				at("a", 1),
				at("a", 2),
				at("b", 3),
				at("a", 4),
				at("a", 5),
				at("a", 6),
			])
		).toStrictEqual([true, false, true, true, true, false, true]);
	});

	it("starts a new run where a timestamp goes backwards", () => {
		expect(
			chooseRecordsToKeep([at("a", 10), at("a", 5), at("a", 6), at("a", 7)])
		).toStrictEqual([true, true, false, true]);
	});

	it("treats records with the same timestamp as one run", () => {
		expect(keepFor("a", [0, 0, 0])).toStrictEqual([true, false, true]);
	});
});

describe("chooseRecordsToKeep: the hour boundaries", () => {
	it("keeps a record exactly an hour after the last one kept, not one minute before", () => {
		expect(keepFor("a", [0, 20, 40, 60, 80, 100, 120])).toStrictEqual([
			true,
			false,
			false,
			true,
			false,
			false,
			true,
		]);
		expect(keepFor("a", [0, 59, 118])).toStrictEqual([true, false, true]);
	});

	it("measures the hour from the last record kept, not from the previous record", () => {
		expect(keepFor("a", [0, 50, 70, 80, 130])).toStrictEqual([
			true,
			false,
			true,
			false,
			true,
		]);
	});

	it("keeps a record whose next record is exactly an hour later", () => {
		expect(keepFor("a", [0, 30, 90, 100])).toStrictEqual([
			true,
			true,
			true,
			true,
		]);
	});

	it("drops a record whose next record is a minute short of an hour later", () => {
		expect(keepFor("a", [0, 30, 89, 100])).toStrictEqual([
			true,
			false,
			true,
			true,
		]);
	});

	it("keeps every record of a sparse stretch", () => {
		expect(keepFor("a", [0, 120, 240, 360])).toStrictEqual([
			true,
			true,
			true,
			true,
		]);
	});

	it("keeps records on both sides of a pause inside a dense stretch", () => {
		expect(keepFor("a", [0, 1, 2, 200, 201, 202])).toStrictEqual([
			true,
			false,
			true,
			true,
			false,
			true,
		]);
	});

	it("keeps the records next to a record without a key, and measures the hour from there", () => {
		expect(
			chooseRecordsToKeep([
				at("a", 0),
				at("a", 40),
				at(null, 50),
				at("a", 51),
				at("a", 100),
				at("a", 105),
			])
		).toStrictEqual([true, true, true, true, false, true]);
	});
});
