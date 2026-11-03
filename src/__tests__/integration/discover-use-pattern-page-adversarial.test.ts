// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSession } from "@/lib/auth/validate-session";
import { listViewablePatterns } from "@/lib/services/case-from-pattern-service";
import { createPublishedRow } from "../utils/pattern-start-kit";

/**
 * The Discover page of a published item, rendered from the database for a
 * visitor with no session. A published pattern offers "Use this pattern" and
 * a published case does not; the page stays public, reading no session and
 * fetching none of the visitor's patterns.
 */

const session = vi.hoisted(() => ({
	status: "unauthenticated" as "authenticated" | "loading" | "unauthenticated",
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data:
			session.status === "authenticated" ? { user: { id: "user-1" } } : null,
		status: session.status,
	}),
}));

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi
		.fn()
		.mockRejectedValue(new Error("a public page must not read a session")),
}));

vi.mock("@/lib/services/case-from-pattern-service", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/case-from-pattern-service")
		>();
	return {
		...actual,
		listViewablePatterns: vi.fn(actual.listViewablePatterns),
	};
});

const USE_THIS_PATTERN = { name: "Use this pattern" };
const DOWNLOAD = { name: /Download JSON/ };
const COPY_SENTENCE =
	"You can also start a new case from a copy of this pattern.";
const SIGN_IN_FIRST = "You will be asked to sign in first.";

async function showPageOf(slug: string) {
	const { default: DiscoverItemPage } = await import(
		"@/app/(landing)/discover/[slug]/page"
	);
	return render(await DiscoverItemPage({ params: Promise.resolve({ slug }) }));
}

afterEach(() => {
	session.status = "unauthenticated";
});

describe("the Discover page of a published item, for a visitor with no session", () => {
	it.each([
		"unauthenticated",
		"loading",
		"authenticated",
	] as const)("offers Use this pattern on a published pattern while the session is %s", async (status) => {
		session.status = status;
		await createPublishedRow({
			slug: "a-published-pattern",
			type: "ARGUMENT_PATTERN",
			title: "A published pattern",
		});

		await showPageOf("a-published-pattern");

		const button = screen.getByRole("button", USE_THIS_PATTERN);
		expect(button).toBeVisible();
		expect(screen.getByText(COPY_SENTENCE, { exact: false })).toBeVisible();
		expect(screen.getByRole("button", DOWNLOAD)).toBeVisible();
		if (status === "loading") {
			expect(button).toBeDisabled();
		} else {
			expect(button).toBeEnabled();
		}
	});

	it("tells a signed-out visitor that sign-in comes first", async () => {
		await createPublishedRow({ slug: "a-published-pattern" });

		await showPageOf("a-published-pattern");

		expect(screen.getByText(SIGN_IN_FIRST)).toBeVisible();
		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeEnabled();
	});

	it("offers Use this pattern on an archived published pattern", async () => {
		await createPublishedRow({
			slug: "an-archived-pattern",
			archivedAt: new Date(),
		});

		await showPageOf("an-archived-pattern");

		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeVisible();
	});

	it("offers only the download on a published case: no button and no sentence", async () => {
		await createPublishedRow({
			slug: "a-published-case",
			type: "ASSURANCE_CASE",
		});

		await showPageOf("a-published-case");

		expect(screen.getByRole("button", DOWNLOAD)).toBeVisible();
		expect(
			screen.queryByRole("button", USE_THIS_PATTERN)
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("start a new case", { exact: false })
		).not.toBeInTheDocument();
		expect(screen.queryByText(SIGN_IN_FIRST)).not.toBeInTheDocument();
	});

	it("reads no session and fetches none of the visitor's patterns", async () => {
		await createPublishedRow({ slug: "a-published-pattern" });
		await createPublishedRow({
			slug: "a-published-case",
			type: "ASSURANCE_CASE",
		});

		await showPageOf("a-published-pattern");
		await showPageOf("a-published-case");

		expect(validateSession).not.toHaveBeenCalled();
		expect(listViewablePatterns).not.toHaveBeenCalled();
	});

	it.each([
		["a slug whose only row has been superseded", "superseded-pattern"],
		["a slug nobody published", "no-such-pattern"],
	])("is not found for %s", async (_label, slug) => {
		await createPublishedRow({
			slug: "superseded-pattern",
			isCurrent: false,
		});

		await expect(showPageOf(slug)).rejects.toThrow("NEXT_NOT_FOUND");
	});
});
