import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAdministrableCases, validateSession } = vi.hoisted(() => ({
	listAdministrableCases: vi.fn(),
	validateSession: vi.fn(),
}));

vi.mock("@/lib/auth/validate-session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/validate-session")>()),
	validateSession,
}));

// The real service opens a database connection on import, which a unit test
// cannot have, so this factory stands in for it; the action reads only one
// function from the module.
vi.mock("@/lib/services/case-fetch-service", () => ({
	listAdministrableCases,
}));

import { fetchAdministrableCases } from "./assurance-cases";

/**
 * The action behind the integrations grant form's case list: it reads the
 * person from the session, never from a caller, and gives nothing back when
 * there is no session or the list cannot be read.
 */

beforeEach(() => {
	listAdministrableCases.mockReset();
	validateSession.mockReset();
});

describe("fetchAdministrableCases", () => {
	it("returns null without reading any list when nobody is signed in", async () => {
		validateSession.mockResolvedValue(null);
		listAdministrableCases.mockResolvedValue({
			data: [{ id: "someone-elses", name: "Someone else's" }],
		});

		expect(await fetchAdministrableCases()).toBeNull();
		expect(listAdministrableCases).not.toHaveBeenCalled();
	});

	it("reads the list for the signed-in person's id, and only that id", async () => {
		validateSession.mockResolvedValue({
			userId: "signed-in-id",
			username: "u",
			email: "u@example.com",
		});
		listAdministrableCases.mockResolvedValue({ data: [] });

		await fetchAdministrableCases();

		expect(listAdministrableCases).toHaveBeenCalledTimes(1);
		expect(listAdministrableCases).toHaveBeenCalledWith("signed-in-id");
	});

	it("returns the list as the service gave it", async () => {
		validateSession.mockResolvedValue({
			userId: "signed-in-id",
			username: "u",
			email: "u@example.com",
		});
		const rows = [
			{ id: "b", name: "Second" },
			{ id: "a", name: "First" },
		];
		listAdministrableCases.mockResolvedValue({ data: rows });

		expect(await fetchAdministrableCases()).toEqual(rows);
	});

	it("returns null, not an empty list, when the service fails", async () => {
		validateSession.mockResolvedValue({
			userId: "signed-in-id",
			username: "u",
			email: "u@example.com",
		});
		listAdministrableCases.mockResolvedValue({
			error: "Failed to fetch cases",
		});

		expect(await fetchAdministrableCases()).toBeNull();
	});
});
