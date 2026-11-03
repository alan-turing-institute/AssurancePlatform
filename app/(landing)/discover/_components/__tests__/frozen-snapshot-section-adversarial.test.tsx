import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateCaseModal } from "@/hooks/modal-hooks";
import type { PublishableItemDetailResponse } from "@/lib/services/discover-transforms";
import FrozenSnapshotSection from "../frozen-snapshot-section";

/**
 * The snapshot section of a published item's page: the download for every
 * item, and "Use this pattern" with its sentence for a published pattern only.
 */

vi.mock(
	"@/hooks/modal-hooks",
	async (importOriginal) => await importOriginal()
);

const USE_THIS_PATTERN = /Use this pattern/;
const DOWNLOAD = { name: /Download JSON/ };
const TAG = /<[^>]*>/;
const COPY_SENTENCE =
	"You can also start a new case from a copy of this pattern.";

function itemOf(
	overrides: Partial<PublishableItemDetailResponse>
): PublishableItemDetailResponse {
	return {
		id: "item-1",
		slug: "a-published-item",
		title: "A published item",
		description: "What the item is for",
		type: "ARGUMENT_PATTERN",
		archivedAt: null,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-10-01T00:00:00.000Z",
		sector: null,
		content: { tree: {} },
		...overrides,
	};
}

beforeEach(() => {
	act(() => {
		useCreateCaseModal.getState().onClose();
	});
});

describe("FrozenSnapshotSection", () => {
	it("offers the download, the button and the sentence for a published pattern", () => {
		render(
			<FrozenSnapshotSection item={itemOf({ type: "ARGUMENT_PATTERN" })} />
		);

		expect(screen.getByRole("button", DOWNLOAD)).toBeVisible();
		expect(
			screen.getByRole("button", { name: USE_THIS_PATTERN })
		).toBeVisible();
		expect(screen.getByText(COPY_SENTENCE, { exact: false })).toBeVisible();
	});

	it("offers only the download for a published case: no button and no sentence", () => {
		render(<FrozenSnapshotSection item={itemOf({ type: "ASSURANCE_CASE" })} />);

		expect(screen.getByRole("button", DOWNLOAD)).toBeVisible();
		expect(
			screen.queryByRole("button", { name: USE_THIS_PATTERN })
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("start a new case", { exact: false })
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("sign in first", { exact: false })
		).not.toBeInTheDocument();
	});

	it("opens the dialog for the page's own pattern", async () => {
		const user = userEvent.setup();
		render(
			<FrozenSnapshotSection
				item={itemOf({
					slug: "fairness-pattern",
					title: "Fairness pattern",
					description: "How a system treats groups alike",
				})}
			/>
		);

		await user.click(screen.getByRole("button", { name: USE_THIS_PATTERN }));

		expect(useCreateCaseModal.getState().isOpen).toBe(true);
		expect(useCreateCaseModal.getState().preset).toEqual({
			slug: "fairness-pattern",
			title: "Fairness pattern",
			description: "How a system treats groups alike",
		});
	});

	it("gives the dialog an empty description for a pattern published without one", async () => {
		const user = userEvent.setup();
		render(<FrozenSnapshotSection item={itemOf({ description: null })} />);

		await user.click(screen.getByRole("button", { name: USE_THIS_PATTERN }));

		expect(useCreateCaseModal.getState().preset?.description).toBe("");
	});

	it("gives the dialog the description as plain text, not as the markup it was published with", async () => {
		const user = userEvent.setup();
		render(
			<FrozenSnapshotSection
				item={itemOf({
					description:
						'<p>How a system treats <strong>groups</strong> alike</p><p>Second <a href="https://example.org/x">paragraph</a></p>',
				})}
			/>
		);

		await user.click(screen.getByRole("button", { name: USE_THIS_PATTERN }));

		const description = useCreateCaseModal.getState().preset?.description ?? "";
		expect(description).not.toMatch(TAG);
		expect(description).toContain("How a system treats groups alike");
		expect(description).toContain("Second paragraph");
		expect(description).not.toContain("alikeSecond");
	});
});
