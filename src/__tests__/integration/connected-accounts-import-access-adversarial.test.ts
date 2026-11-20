import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getConnectedAccounts } from "@/lib/services/connected-accounts-service";
import { createTestUser } from "../utils/prisma-factories";

type GitHubColumns = Partial<{
	githubId: string | null;
	githubAccessToken: string | null;
	githubTokenExpiresAt: Date | null;
}>;

const HOUR = 60 * 60 * 1000;

async function githubFor(columns: GitHubColumns) {
	const user = await createTestUser();
	await prisma.user.update({ where: { id: user.id }, data: columns });
	const result = await getConnectedAccounts(user.id);
	if (!("data" in result)) {
		throw new Error("expected success");
	}
	return result;
}

describe("GitHub import access", () => {
	it("is false for a user with no GitHub account at all", async () => {
		const { data } = await githubFor({});

		expect(data.github.connected).toBe(false);
		expect(data.github.hasImportAccess).toBe(false);
	});

	it("is false when the stored token is an empty string", async () => {
		const { data } = await githubFor({
			githubId: "gh-1",
			githubAccessToken: "",
		});

		expect(data.github.connected).toBe(true);
		expect(data.github.hasImportAccess).toBe(false);
	});

	it("is false when the token is gone and only an unexpired date is left", async () => {
		const { data } = await githubFor({
			githubId: "gh-1",
			githubAccessToken: null,
			githubTokenExpiresAt: new Date(Date.now() + HOUR),
		});

		expect(data.github.hasImportAccess).toBe(false);
	});

	it("is false for an expired token whatever its content", async () => {
		const { data } = await githubFor({
			githubId: "gh-1",
			githubAccessToken: "stored-token",
			githubTokenExpiresAt: new Date(Date.now() - 1000),
		});

		expect(data.github.hasImportAccess).toBe(false);
	});

	it("is true once a fresh token replaces an expired one", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: {
				githubId: "gh-1",
				githubAccessToken: "old",
				githubTokenExpiresAt: new Date(Date.now() - HOUR),
			},
		});
		await prisma.user.update({
			where: { id: user.id },
			data: {
				githubAccessToken: "new",
				githubTokenExpiresAt: new Date(Date.now() + HOUR),
			},
		});

		const result = await getConnectedAccounts(user.id);

		expect("data" in result && result.data.github.hasImportAccess).toBe(true);
	});

	it("never carries the token itself in what it returns", async () => {
		const { data } = await githubFor({
			githubId: "gh-1",
			githubAccessToken: "secret-token-value",
		});

		expect(JSON.stringify(data)).not.toContain("secret-token-value");
	});
});
