import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	getShowUnsupportedMarkers,
	setShowUnsupportedMarkers,
} from "@/lib/services/unsupported-marker-service";
import { getCurrentUser } from "@/lib/services/user-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

// Factory pattern prevents dotenv.config() from overwriting DATABASE_URL
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

async function storedValue(userId: string): Promise<boolean | undefined> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { showUnsupportedMarkers: true },
	});
	return user?.showUnsupportedMarkers;
}

describe("the unsupported marker setting — column", () => {
	it("is a non-null boolean column that defaults to on, so an existing account takes the default", async () => {
		const columns = await prisma.$queryRaw<
			Array<{ column_default: string; data_type: string; is_nullable: string }>
		>`SELECT column_default, data_type, is_nullable
			FROM information_schema.columns
			WHERE table_name = 'users' AND column_name = 'show_unsupported_markers'`;

		expect(columns).toEqual([
			{ column_default: "true", data_type: "boolean", is_nullable: "NO" },
		]);
	});

	it("starts on for a new account", async () => {
		const user = await createTestUser();

		expect(await storedValue(user.id)).toBe(true);
	});
});

describe("the unsupported marker setting — service", () => {
	it("reads on for an account that has never changed it", async () => {
		const user = await createTestUser();

		expect(await getShowUnsupportedMarkers(user.id)).toEqual({ data: true });
	});

	it("saves off, reads it back, and saves on again", async () => {
		const user = await createTestUser();

		expect(await setShowUnsupportedMarkers(user.id, false)).toEqual({
			data: false,
		});
		expect(await getShowUnsupportedMarkers(user.id)).toEqual({ data: false });
		expect(await storedValue(user.id)).toBe(false);

		expect(await setShowUnsupportedMarkers(user.id, true)).toEqual({
			data: true,
		});
		expect(await getShowUnsupportedMarkers(user.id)).toEqual({ data: true });
	});

	it("keeps the value when the same value is saved again", async () => {
		const user = await createTestUser();

		await setShowUnsupportedMarkers(user.id, false);
		await setShowUnsupportedMarkers(user.id, false);

		expect(await storedValue(user.id)).toBe(false);
	});

	it("changes only the signed-in user's own setting", async () => {
		const first = await createTestUser();
		const second = await createTestUser();

		await setShowUnsupportedMarkers(first.id, false);

		expect(await storedValue(first.id)).toBe(false);
		expect(await storedValue(second.id)).toBe(true);
	});

	it("changes nothing else about the user", async () => {
		const user = await createTestUser({ firstName: "Ada", lastName: "L" });

		await setShowUnsupportedMarkers(user.id, false);
		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});

		expect({ ...after, showUnsupportedMarkers: true, updatedAt: null }).toEqual(
			{ ...user, showUnsupportedMarkers: true, updatedAt: null }
		);
	});

	it("refuses an account that does not exist, on read and on write", async () => {
		const missing = "00000000-0000-4000-8000-000000000000";

		expect(await getShowUnsupportedMarkers(missing)).toEqual({
			error: "Permission denied",
		});
		expect(await setShowUnsupportedMarkers(missing, false)).toEqual({
			error: "Permission denied",
		});
	});

	it("is part of the profile the Settings page reads", async () => {
		const user = await createTestUser();

		const before = await getCurrentUser(user.id);
		await setShowUnsupportedMarkers(user.id, false);
		const after = await getCurrentUser(user.id);

		expect(before).toMatchObject({ data: { showUnsupportedMarkers: true } });
		expect(after).toMatchObject({ data: { showUnsupportedMarkers: false } });
	});
});

describe.sequential("the unsupported marker setting — server action", () => {
	it("reads null and saves nothing for a signed-out caller", async () => {
		const user = await createTestUser();
		const { fetchShowUnsupportedMarkers, saveShowUnsupportedMarkers } =
			await import("@/actions/unsupported-markers");

		expect(await fetchShowUnsupportedMarkers()).toBeNull();
		expect(await saveShowUnsupportedMarkers(false)).toBeNull();
		expect(await storedValue(user.id)).toBe(true);
	});

	it("reads and saves the signed-in user's own setting", async () => {
		const user = await createTestUser();
		const other = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const { fetchShowUnsupportedMarkers, saveShowUnsupportedMarkers } =
			await import("@/actions/unsupported-markers");

		expect(await fetchShowUnsupportedMarkers()).toBe(true);
		expect(await saveShowUnsupportedMarkers(false)).toBe(false);
		expect(await fetchShowUnsupportedMarkers()).toBe(false);
		expect(await storedValue(user.id)).toBe(false);
		expect(await storedValue(other.id)).toBe(true);
	});

	it("cannot change another user's setting, however the call is made", async () => {
		const alice = await createTestUser();
		const bob = await createTestUser();
		await mockAuth(alice.id, alice.username, alice.email);
		const { saveShowUnsupportedMarkers } = await import(
			"@/actions/unsupported-markers"
		);
		const saveWithExtras = saveShowUnsupportedMarkers as unknown as (
			...args: unknown[]
		) => Promise<unknown>;

		await saveShowUnsupportedMarkers(false);
		await saveWithExtras(false, bob.id);
		await saveWithExtras({ show: false, userId: bob.id });

		expect(await storedValue(alice.id)).toBe(false);
		expect(await storedValue(bob.id)).toBe(true);
	});

	it("reads only the signed-in user's setting, not another user's", async () => {
		const alice = await createTestUser();
		const bob = await createTestUser();
		await setShowUnsupportedMarkers(bob.id, false);
		const { fetchShowUnsupportedMarkers } = await import(
			"@/actions/unsupported-markers"
		);

		await mockAuth(alice.id, alice.username, alice.email);
		expect(await fetchShowUnsupportedMarkers()).toBe(true);

		await mockAuth(bob.id, bob.username, bob.email);
		expect(await fetchShowUnsupportedMarkers()).toBe(false);
	});

	it("refuses a value that is not a boolean and leaves the stored setting alone", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const { saveShowUnsupportedMarkers } = await import(
			"@/actions/unsupported-markers"
		);

		for (const bad of ["false", 0, null, undefined, { show: false }]) {
			expect(await saveShowUnsupportedMarkers(bad as never)).toBeNull();
		}
		expect(await storedValue(user.id)).toBe(true);
	});

	it.each([
		["the string true", "true"],
		["the number 1", 1],
		["a non-empty string", "yes"],
		["an object", {}],
	])("refuses %s and leaves an off setting off", async (_label, value) => {
		const user = await createTestUser();
		await setShowUnsupportedMarkers(user.id, false);
		await mockAuth(user.id, user.username, user.email);
		const { saveShowUnsupportedMarkers } = await import(
			"@/actions/unsupported-markers"
		);

		expect(await saveShowUnsupportedMarkers(value as never)).toBeNull();
		expect(await storedValue(user.id)).toBe(false);
	});

	it("reads null when the signed-in account no longer exists", async () => {
		await mockAuth("00000000-0000-4000-8000-000000000000");
		const { fetchShowUnsupportedMarkers, saveShowUnsupportedMarkers } =
			await import("@/actions/unsupported-markers");

		expect(await fetchShowUnsupportedMarkers()).toBeNull();
		expect(await saveShowUnsupportedMarkers(false)).toBeNull();
	});
});

describe("the unsupported marker setting — cases", () => {
	it("exports the same case whether the owner has the markers on or off, with no marker or status added", async () => {
		const { exportCase } = await import("@/lib/services/case-export-service");
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "A case with a gap",
		});
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
			description: "A goal with nothing beneath it",
			role: "TOP_LEVEL",
		});

		const withMarkers = expectSuccess(await exportCase(owner.id, testCase.id));
		await setShowUnsupportedMarkers(owner.id, false);
		const withoutMarkers = expectSuccess(
			await exportCase(owner.id, testCase.id)
		);

		const comparable = (data: Record<string, unknown>) =>
			JSON.stringify({ ...data, exportedAt: null });
		expect(comparable(withoutMarkers)).toBe(comparable(withMarkers));
		expect(JSON.stringify(withMarkers).toLowerCase()).not.toContain(
			"unsupported"
		);
		const after = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: goal.id },
			select: { assertionStatus: true },
		});
		expect(after.assertionStatus).toBe(goal.assertionStatus);
		expect(after.assertionStatus).not.toBe("NEEDS_SUPPORT");
	});
});
