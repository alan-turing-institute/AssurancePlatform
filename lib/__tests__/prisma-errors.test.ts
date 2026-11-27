import { describe, expect, it } from "vitest";
import { Prisma } from "@/src/generated/prisma";
import { isUniqueConstraintError, isWriteConflict } from "../prisma-errors";

function knownError(
	code: string,
	meta?: Record<string, unknown>
): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("database said no", {
		code,
		clientVersion: "0.0.0-test",
		meta,
	});
}

function driverCause(cause: Record<string, unknown>): Record<string, unknown> {
	return { driverAdapterError: { cause } };
}

describe("isWriteConflict", () => {
	it("recognises P2034", () => {
		expect(isWriteConflict(knownError("P2034"))).toBe(true);
	});

	it("recognises a raw-query error whose driver cause is a write conflict", () => {
		const error = knownError(
			"P2010",
			driverCause({ kind: "TransactionWriteConflict" })
		);

		expect(isWriteConflict(error)).toBe(true);
	});

	it("recognises a raw-query error whose driver cause is a deadlock", () => {
		const error = knownError("P2010", driverCause({ originalCode: "40P01" }));

		expect(isWriteConflict(error)).toBe(true);
	});

	it.each([
		["P2002", undefined],
		["P2010", undefined],
		["P2010", {}],
		["P2010", { driverAdapterError: {} }],
		["P2010", driverCause({})],
		["P2010", driverCause({ kind: "UniqueConstraintViolation" })],
		["P2010", driverCause({ originalCode: "23505" })],
		["P2010", driverCause({ originalCode: "40001" })],
	])("refuses %s with meta %j", (code, meta) => {
		expect(isWriteConflict(knownError(code, meta))).toBe(false);
	});

	it.each([
		["a plain error", new Error("deadlock detected")],
		["an object carrying the code", { code: "P2034" }],
		["null", null],
		["undefined", undefined],
		["a string", "P2034"],
	])("refuses %s", (_label, thrown) => {
		expect(isWriteConflict(thrown)).toBe(false);
	});

	it("refuses a plain error that carries the code", () => {
		const error = Object.assign(new Error("x"), { code: "P2034" });

		expect(isWriteConflict(error)).toBe(false);
	});
});

describe("isUniqueConstraintError", () => {
	it("recognises P2002", () => {
		expect(isUniqueConstraintError(knownError("P2002"))).toBe(true);
	});

	it.each(["P2003", "P2034", "P2025", ""])("refuses %j", (code) => {
		expect(isUniqueConstraintError(knownError(code))).toBe(false);
	});

	it.each([
		["a plain error", Object.assign(new Error("x"), { code: "P2002" })],
		["an object carrying the code", { code: "P2002" }],
		["null", null],
		["undefined", undefined],
		["a string", "P2002"],
	])("refuses %s", (_label, thrown) => {
		expect(isUniqueConstraintError(thrown)).toBe(false);
	});
});
