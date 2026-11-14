import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import { item, status } from "./health-test-data";

// The suite-wide mocks replace the dialog and the radio group with plain
// elements that handle Escape and the arrow keys on their own. This file runs
// the real components, since focus and key handling are what it checks.
vi.unmock("@radix-ui/react-radio-group");
vi.unmock("@radix-ui/react-dialog");

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const EVIDENCE_URL = "/api/machine/health/elements/claim-42/evidence";
const STATUS_URL = "/api/elements/claim-42/health";
const REVOCATION_URL =
	"/api/elements/claim-42/health/records/:recordId/revocation";

const REVOKED = {
	cause: "duplicate",
	reason: "Posted twice",
	revoked_at: "2026-10-02T09:00:00.000Z",
	revoked_by_name: "Alice",
} as const;

/** Stands in for the canvas node, which cancels arrow keys and Space unless they come from inside a `nokey` element. */
function CanvasKeyHandler({ children }: { children: ReactNode }) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: mirrors the canvas node wrapper, which is a div with role=button
		<div
			onKeyDown={(event) => {
				if (!(event.target as HTMLElement).closest(".nokey")) {
					event.preventDefault();
				}
			}}
			role="button"
			tabIndex={-1}
		>
			{children}
		</div>
	);
}

beforeEach(() => {
	vi.mocked(useCaseEvents).mockReturnValue({
		status: "connected",
		isConnected: true,
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	});
});

function serveLog(isRevoked: () => boolean = () => false) {
	server.use(
		http.get(EVIDENCE_URL, () =>
			HttpResponse.json({
				evidence: [item(isRevoked() ? { revocation: REVOKED } : {})],
				next_before: null,
			})
		),
		http.get(STATUS_URL, () => HttpResponse.json({ status: status() }))
	);
}

async function openRevokeDialog(user: ReturnType<typeof userEvent.setup>) {
	render(
		<CanvasKeyHandler>
			<HealthPanel
				canEdit
				caseId="case-1"
				elementId="claim-42"
				elementType="property"
			/>
		</CanvasKeyHandler>,
		{ withProviders: false }
	);
	const opener = await screen.findByRole("button", { name: "Revoke" });
	await user.click(opener);
	return { opener, dialog: await screen.findByRole("dialog") };
}

describe("revoke dialog — keyboard", () => {
	it("moves between causes with the arrow keys, chooses one with Space and submits using only the keyboard", async () => {
		let body: unknown;
		serveLog();
		server.use(
			http.post(REVOCATION_URL, async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ revocation: {} }, { status: 201 });
			})
		);
		const user = userEvent.setup();
		const { dialog } = await openRevokeDialog(user);
		const submit = within(dialog).getByRole("button", { name: "Revoke" });
		expect(submit).toBeDisabled();

		const first = within(dialog).getByRole("radio", {
			name: "Evidence defect",
		});
		expect(first).toHaveFocus();
		await user.keyboard(" ");
		expect(first).toBeChecked();

		await user.keyboard("{ArrowDown}");
		const second = within(dialog).getByRole("radio", {
			name: "Binding defect",
		});
		expect(second).toHaveFocus();
		await user.keyboard(" ");
		expect(second).toBeChecked();
		expect(first).not.toBeChecked();

		await user.tab();
		await user.keyboard("Posted twice");
		await user.tab();
		await user.tab();
		expect(submit).toHaveFocus();
		await user.keyboard("{Enter}");

		await waitFor(() =>
			expect(body).toEqual({ cause: "binding-defect", reason: "Posted twice" })
		);
	});
});

describe("record dialogs — focus", () => {
	it("returns focus to the opening control when Escape closes the dialog", async () => {
		serveLog();
		const user = userEvent.setup();
		const { opener } = await openRevokeDialog(user);

		await user.keyboard("{Escape}");

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(opener).toHaveFocus();
	});

	it("returns focus to the opening control when Cancel closes the dialog", async () => {
		serveLog();
		const user = userEvent.setup();
		const { opener, dialog } = await openRevokeDialog(user);

		await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(opener).toHaveFocus();
	});

	it("focuses the Reinstate control after a successful revoke replaces Revoke", async () => {
		let revoked = false;
		serveLog(() => revoked);
		server.use(
			http.post(REVOCATION_URL, () => {
				revoked = true;
				return HttpResponse.json({ revocation: {} }, { status: 201 });
			})
		);
		const user = userEvent.setup();
		const { dialog } = await openRevokeDialog(user);
		await user.click(within(dialog).getByRole("radio", { name: "Duplicate" }));
		await user.type(within(dialog).getByLabelText("Reason"), "Posted twice");
		await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

		const reinstate = await screen.findByRole("button", { name: "Reinstate" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(reinstate).toHaveFocus();
	});
});
