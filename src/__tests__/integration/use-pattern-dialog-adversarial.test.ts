// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import "../setup/dom-polyfills";
import "../setup/component-mocks";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchViewablePatterns } from "@/actions/case-from-pattern";
import { CaseCreateModal } from "@/components/modals/case-create-modal";
import { useCreateCaseModal } from "@/hooks/modal-hooks";
import prisma from "@/lib/prisma";
import { mockAuth } from "../utils/auth-helpers";
import {
	createPublishedRow,
	makePattern,
	snapshotWithComments,
} from "../utils/pattern-start-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * The new-case dialog opened from a published pattern's page, working through
 * the real action and service against the database: what the picker offers
 * once the visitor's list has loaded, whatever the service adds to the list.
 */

const signedIn = vi.hoisted(() => ({ userId: "" }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: { user: { id: signedIn.userId } },
		status: "authenticated",
	}),
}));

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/actions/case-from-pattern", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/actions/case-from-pattern")>();
	return {
		...actual,
		fetchViewablePatterns: vi.fn(actual.fetchViewablePatterns),
	};
});

const PATTERN_NAME = "Fairness pattern";
const SLUG = "fairness-pattern";

type User = Awaited<ReturnType<typeof createTestUser>>;

async function signInAs(user: User) {
	signedIn.userId = user.id;
	await mockAuth(user.id, user.username, user.email ?? undefined);
}

/** Opens the dialog the way the page does and waits for the list to load. */
async function openFromThePage(description: string) {
	render(createElement(CaseCreateModal));
	act(() => {
		useCreateCaseModal.getState().onOpenWith({
			slug: SLUG,
			title: PATTERN_NAME,
			description,
		});
	});
	await waitFor(() => expect(fetchViewablePatterns).toHaveBeenCalled());
	await act(async () => {
		await vi.mocked(fetchViewablePatterns).mock.results[0]?.value;
	});
}

async function offeredOptions(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("combobox", { name: "Pattern" }));
	return screen.getAllByRole("option").map((option) => ({
		name: option.textContent?.trim(),
		selected: option.getAttribute("aria-selected") === "true",
	}));
}

beforeEach(() => {
	vi.clearAllMocks();
	act(() => {
		useCreateCaseModal.getState().onClose();
	});
});

describe("the new-case dialog opened from a published pattern's page, with the visitor's real list", () => {
	it("offers the pattern once, and chosen, to a visitor who can view its source case", async () => {
		const user = userEvent.setup();
		const owner = await createTestUser();
		const pattern = await makePattern(owner, { name: PATTERN_NAME });
		await createPublishedRow({
			slug: SLUG,
			title: PATTERN_NAME,
			description: "Plain description",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		await signInAs(owner);

		await openFromThePage("Plain description");

		const options = await offeredOptions(user);
		expect(options.filter((option) => option.name === PATTERN_NAME)).toEqual([
			{ name: PATTERN_NAME, selected: true },
		]);
	});

	it("creates a case from the pattern, linked to its source case, for a visitor who can view that case", async () => {
		const user = userEvent.setup();
		const owner = await createTestUser();
		const pattern = await makePattern(owner, { name: PATTERN_NAME });
		await createPublishedRow({
			slug: SLUG,
			title: PATTERN_NAME,
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		await signInAs(owner);
		await openFromThePage("A published pattern");

		await user.type(screen.getByLabelText("Name"), "Started from the page");
		await user.type(screen.getByLabelText("Description"), "About it");
		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
		const created = await prisma.assuranceCase.findFirstOrThrow({
			where: { name: "Started from the page" },
		});
		expect(router.push).toHaveBeenCalledWith(`/case/${created.id}`);
		expect(created).toMatchObject({
			kind: "CASE",
			createdById: owner.id,
			sourcePatternId: pattern.id,
		});
	});

	it("offers the pattern once, and chosen, to a visitor who cannot view its source case", async () => {
		const user = userEvent.setup();
		const owner = await createTestUser();
		const pattern = await makePattern(owner, { name: PATTERN_NAME });
		await createPublishedRow({
			slug: SLUG,
			title: PATTERN_NAME,
			description: "Plain description",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const stranger = await createTestUser();
		await signInAs(stranger);

		await openFromThePage("Plain description");

		const options = await offeredOptions(user);
		expect(options).toEqual([{ name: PATTERN_NAME, selected: true }]);
	});

	it("shows the description of a pattern published with formatting as plain words", async () => {
		const owner = await createTestUser();
		const pattern = await makePattern(owner, { name: PATTERN_NAME });
		await createPublishedRow({
			slug: SLUG,
			title: PATTERN_NAME,
			description: "<p>How a system treats <strong>groups</strong> alike</p>",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const stranger = await createTestUser();
		await signInAs(stranger);

		await openFromThePage("How a system treats groups alike");

		expect(
			await screen.findByText("How a system treats groups alike")
		).toBeVisible();
		expect(
			screen.queryByText("<strong>", { exact: false })
		).not.toBeInTheDocument();
		expect(screen.queryByText("<p>", { exact: false })).not.toBeInTheDocument();
	});
});
