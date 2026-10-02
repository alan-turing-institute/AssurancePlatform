import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots/index";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthBadge } from "../health-badge";
import { VERDICT_DOT_CLASSES } from "../health-format";
import { HealthPanel } from "../health-panel";
import type { HealthEvidenceLogItem, HealthStatus } from "../health-types";
import { item, status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({ useCaseEvents: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const STALE_SINCE = /stale since/;
const ONERROR = /onerror/i;
const CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};
const EVIDENCE_URL = `/api/machine/health/elements/${CONTEXT.elementId}/evidence`;
const STATUS_URL = `/api/elements/${CONTEXT.elementId}/health`;
const RING = "ring-2";

beforeEach(() => {
	vi.mocked(useCaseEvents).mockReturnValue({
		status: "connected",
		isConnected: true,
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	});
	vi.mocked(toast).mockClear();
});

async function dot(body: HealthStatus | null) {
	server.use(http.get(STATUS_URL, () => HttpResponse.json({ status: body })));
	render(<HealthBadge {...CONTEXT} />, { withProviders: false });
	return await screen.findByTestId("health-badge-dot").catch(() => null);
}

function mockLog(
	evidence: HealthEvidenceLogItem[],
	health: HealthStatus | null = status()
) {
	server.use(
		http.get(EVIDENCE_URL, () =>
			HttpResponse.json({ evidence, next_before: null })
		),
		http.get(STATUS_URL, () => HttpResponse.json({ status: health }))
	);
}

describe("badge", () => {
	it.each([
		["pass"],
		["marginal"],
		["fail"],
		["indeterminate"],
	] as const)("a current %s record gets its own colour and no ring", async (verdict) => {
		const element = await dot(status({ verdict }));

		expect(element).not.toBeNull();
		expect(element?.className).toContain(VERDICT_DOT_CLASSES[verdict]);
		expect(element?.className).not.toContain(RING);
		const others = (["pass", "marginal", "fail", "indeterminate"] as const)
			.filter((v) => v !== verdict)
			.map((v) => VERDICT_DOT_CLASSES[v]);
		for (const other of others) {
			expect(VERDICT_DOT_CLASSES[verdict]).not.toBe(other);
		}
	});

	it("keeps the verdict colour and adds the ring when the server says stale", async () => {
		const element = await dot(
			status({
				verdict: "pass",
				stale: true,
				stale_reason: "expired",
				stale_since: new Date(Date.now() - 60_000).toISOString(),
			})
		);

		expect(element?.className).toContain(VERDICT_DOT_CLASSES.pass);
		expect(element?.className).toContain(RING);
		expect(element?.getAttribute("aria-label")).toMatch(STALE_SINCE);
	});

	it("adds the ring when the expiry has passed on the viewer's clock although the server still says fresh", async () => {
		const element = await dot(
			status({
				verdict: "fail",
				stale: false,
				expires_at: new Date(Date.now() - 1000).toISOString(),
			})
		);

		expect(element?.className).toContain(VERDICT_DOT_CLASSES.fail);
		expect(element?.className).toContain(RING);
	});

	it("shows an unfilled, ringed dot labelled 'all evidence revoked' when no verdict is left", async () => {
		const element = await dot(
			status({
				verdict: null,
				stale: true,
				stale_reason: "all-revoked",
				record_id: null,
				timestamp: null,
				expires_at: null,
			})
		);

		expect(element?.className).toContain(RING);
		expect(element?.className).toContain("bg-transparent");
		expect(element?.getAttribute("aria-label")).toBe(
			"Health: all evidence revoked"
		);
	});

	it.each([
		["no status at all", null],
		[
			"a claim bound to a check that has no record yet",
			status({
				verdict: null,
				stale: false,
				stale_reason: null,
				record_id: null,
				timestamp: null,
				expires_at: null,
			}),
		],
	])("renders nothing for %s", async (_name, body) => {
		const element = await dot(body);

		expect(element).toBeNull();
	});
});

describe("evidence log: untrusted producer text", () => {
	const linkHrefs = () =>
		screen.queryAllByRole("link").map((a) => a.getAttribute("href") ?? "");

	it.each([
		["a javascript: address", "javascript:alert(1)"],
		["an address with a leading space", " https://evil.example/run/1"],
		["an uppercase scheme", "HTTPS://evil.example/run/1"],
		["a data: address", "data:text/html,<script>alert(1)</script>"],
		["a scheme-less address", "evil.example/run/1"],
	])("shows a run value of %s as text, not as a link", async (_name, run) => {
		const base = item();
		const entry = item(
			{},
			{
				provenance: {
					...base.record.provenance,
					run,
				},
			}
		);
		mockLog([entry]);
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		await screen.findByTestId("health-evidence-log");

		expect(linkHrefs().filter((h) => h.includes(run.trim()))).toEqual([]);
		expect(
			linkHrefs().every(
				(h) => h.startsWith("http://") || h.startsWith("https://")
			)
		).toBe(true);
	});

	it("makes a plain https run address a link", async () => {
		const base = item();
		mockLog([
			item(
				{},
				{
					provenance: {
						...base.record.provenance,
						run: "https://ci.example.org/runs/17",
					},
				}
			),
		]);
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		await screen.findByTestId("health-evidence-log");

		expect(linkHrefs()).toContain("https://ci.example.org/runs/17");
	});

	it("renders markup in a comment, a check name, a failed subject and a revocation reason as plain text", async () => {
		const markup = '<img src=x onerror="alert(1)"><b>bold</b>';
		const base = item();
		const entry = item(
			{
				revocation: {
					cause: "other",
					reason: markup,
					revoked_at: "2026-10-02T09:00:00.000Z",
					revoked_by_name: markup,
				},
			},
			{
				comment: markup,
				check: { ...base.record.check, name: markup },
				provenance: {
					...base.record.provenance,
					failed_subjects: [{ kind: "sensor", id: markup }],
				},
			}
		);
		mockLog([entry], status({ bound_check: markup }));
		const { container } = render(<HealthPanel {...CONTEXT} />, {
			withProviders: false,
		});
		await screen.findByTestId("health-evidence-log");

		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("b")).toBeNull();
		expect(screen.getAllByText(ONERROR).length).toBeGreaterThan(0);
	});
});

describe("evidence log: controls and refusals", () => {
	const revoked = (): HealthEvidenceLogItem =>
		item(
			{
				id: "row-revoked",
				revocation: {
					cause: "other",
					reason: "Wrong run",
					revoked_at: "2026-10-02T09:00:00.000Z",
					revoked_by_name: "alice",
				},
				chain_sequence: 2,
			},
			{ record_id: "e0bbe873-0000-4000-8000-0000000000aa" }
		);

	it.each([
		["Revoke"],
		["Reinstate"],
		["Change"],
	])("shows no %s control without canEdit and shows it with canEdit", async (name) => {
		const live = item({ id: "row-live", chain_sequence: 3 });
		mockLog([live, revoked()]);
		const view = render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		await screen.findByTestId("health-evidence-log");
		expect(screen.queryByRole("button", { name })).toBeNull();
		view.unmount();

		mockLog([live, revoked()]);
		render(<HealthPanel {...CONTEXT} canEdit />, { withProviders: false });
		expect(
			(await screen.findAllByRole("button", { name })).length
		).toBeGreaterThan(0);
	});

	it("keeps the dialog open, keeps what was typed and shows the server's own message when a revocation is refused", async () => {
		const user = userEvent.setup();
		server.use(
			http.post(
				"/api/elements/claim-42/health/records/:recordId/revocation",
				() =>
					HttpResponse.json(
						{ error: "This record is already revoked" },
						{ status: 409 }
					)
			)
		);
		mockLog([item({ id: "row-live" })]);
		render(<HealthPanel {...CONTEXT} canEdit />, { withProviders: false });

		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getAllByRole("radio").at(0) as HTMLElement);
		await user.type(within(dialog).getByLabelText("Reason"), "Typed reason");
		await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					description: "This record is already revoked",
				})
			)
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(
			within(screen.getByRole("dialog")).getByLabelText("Reason")
		).toHaveValue("Typed reason");
	});

	it("will not submit a revocation without a cause, or with a blank reason", async () => {
		const user = userEvent.setup();
		let sent = false;
		server.use(
			http.post(
				"/api/elements/claim-42/health/records/:recordId/revocation",
				() => {
					sent = true;
					return HttpResponse.json({}, { status: 201 });
				}
			)
		);
		mockLog([item({ id: "row-live" })]);
		render(<HealthPanel {...CONTEXT} canEdit />, { withProviders: false });

		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		const dialog = await screen.findByRole("dialog");
		const submit = within(dialog).getByRole("button", { name: "Revoke" });
		await user.type(within(dialog).getByLabelText("Reason"), "   ");
		expect(submit).toBeDisabled();
		await user.click(within(dialog).getAllByRole("radio").at(0) as HTMLElement);
		expect(submit).toBeDisabled();
		await user.type(within(dialog).getByLabelText("Reason"), "ok");
		expect(submit).toBeEnabled();
		expect(sent).toBe(false);
	});
});
