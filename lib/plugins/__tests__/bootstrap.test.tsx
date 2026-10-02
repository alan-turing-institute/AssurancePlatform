import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import NodeEditDialog from "@/components/cases/node-edit-dialog";
import { useCaseEvents } from "@/hooks/use-case-events";
import { useElementBadgeSlot } from "@/hooks/use-element-badge-slot";
import { HealthBadge } from "@/lib/plugins/health/health-badge";
import { HealthPanel } from "@/lib/plugins/health/health-panel";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementBadgeSlot, elementPanelSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";

/**
 * `lib/plugins/bootstrap.ts` — THE sanctioned import point (ADR 0002 v2
 * §2.3 implementation decision, cid 2026-07-04) — imported for its real
 * module-load side effect, exactly as `providers/modal-provider.tsx` imports
 * it in the running app. This is deliberately NOT test-only registration:
 * every other health-plugin test either renders `HealthBadge`/`HealthPanel`
 * directly or (in `node-edit-dialog.test.tsx`) hand-registers a `FakePanel`
 * test double. This file is the one place proving the production import
 * chain itself — bootstrap -> health/register -> the slot registries -> the
 * render-time hooks (`useElementBadgeSlot`/`useElementPanelSlot`) — actually
 * wires the real components up, with nothing standing in for anything.
 */
import "@/lib/plugins/bootstrap";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CLAIM_ELEMENT_ID = "1";
const CASE_ID = "case-1";

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: CASE_ID,
	elementId: CLAIM_ELEMENT_ID,
	elementType: "property",
};

const PROPERTY_NODE: Node = {
	id: "1",
	type: "property",
	position: { x: 0, y: 0 },
	data: {
		id: 1,
		name: "P1",
		description: "The system fails safe under load",
	},
};

function mockPluginEnabled() {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "Claim/Evidence Health",
						version: "0.1.0",
						description: "Test plugin description.",
						docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
						surfaces: [],
						available: true,
						enabled: true,
						pinnedAt: null,
						settings: null,
					} satisfies PluginSettingsListItem,
				],
			})
		)
	);
}

function mockHealthState() {
	server.use(
		http.get(`/api/elements/${CLAIM_ELEMENT_ID}/health`, () =>
			HttpResponse.json({
				status: {
					bound_check: "Sensor Range Checker",
					rejected_since_last_accept: 0,
					verdict: "pass",
					expires_at: new Date(Date.now() + 3_600_000).toISOString(),
					record_id: "e0bbe873-0000-4000-8000-000000000001",
					timestamp: new Date().toISOString(),
					stale: false,
					stale_reason: null,
					stale_since: null,
				},
			})
		)
	);
}

function mockEvidenceLog() {
	server.use(
		http.get(`/api/machine/health/elements/${CLAIM_ELEMENT_ID}/evidence`, () =>
			HttpResponse.json({
				evidence: [
					{
						id: "row-1",
						record: {
							format_version: "1.1",
							record_id: "e0bbe873-0000-4000-8000-000000000001",
							timestamp: new Date().toISOString(),
							claim_ref: "7acd824e-0000-4000-8000-000000000001",
							check: {
								name: "Sensor Range Checker",
								version: "1.2",
								scope: "sensor",
							},
							rule: { kind: "identity", version: "r1" },
							verdict: "pass",
							window: "PT1M",
							valid_for: "PT1H",
							provenance: { session: "RUN-A", pipeline_version: "0.4.0" },
							value: { number: 0.97, unit: "ratio" },
						},
						chain_sequence: 1,
						record_hash: "hash-1",
						previous_record_hash: null,
						created_by_id: "system-user-1",
						created_at: new Date().toISOString(),
						expires_at: null,
						revocation: null,
					},
				],
				next_before: null,
			})
		)
	);
}

/**
 * A minimal host for the real `useElementBadgeSlot` hook — the same hook
 * `property-node.tsx`/`goal-node.tsx`/`evidence-node.tsx`/`strategy-node.tsx`
 * call in production. This is not a registration shortcut: nothing here
 * registers anything. It only mounts the render-time consumer side of the
 * chain the top-level `bootstrap` import already populated, without dragging
 * in the full canvas-node chrome (`BaseNode`/`NodeActionGroup`/
 * `ToggleButton`/`NodeOptionsMenu`) that this feature doesn't touch and that
 * `reactflow`'s test-suite-wide mock (`useNodes`/`useEdges` are absent from
 * it) can't currently support rendering anyway.
 */
function ElementBadgeSlotHost(context: ElementSlotContext) {
	return <>{useElementBadgeSlot(context)}</>;
}

afterEach(() => {
	elementBadgeSlot.resetForTests();
	elementPanelSlot.resetForTests();
	vi.restoreAllMocks();
});

describe("lib/plugins/bootstrap — real end-to-end wiring", () => {
	it("registers the health plugin's real HealthBadge/HealthPanel, then renders both the badge and the Evidence tab through the production hooks", async () => {
		// The bootstrap's module-load side effect (the bare `import` above)
		// already ran by the time this test executes — assert it registered
		// the actual production components (reference equality, not a
		// look-alike) before rendering anything.
		expect(elementBadgeSlot.list()).toEqual([
			{ pluginId: "tea.health", Component: HealthBadge },
		]);
		expect(elementPanelSlot.list()).toEqual([
			{
				pluginId: "tea.health",
				tabId: "tea.health",
				label: "Evidence",
				Component: HealthPanel,
			},
		]);

		vi.mocked(useCaseEvents).mockReturnValue({
			status: "connected",
			isConnected: true,
			lastEvent: null,
			reconnect: vi.fn(),
			disconnect: vi.fn(),
		});
		mockPluginEnabled();
		mockHealthState();
		mockEvidenceLog();

		// --- element-badge slot: the real useElementBadgeSlot hook renders
		// the real HealthBadge it read out of the registry ---
		render(<ElementBadgeSlotHost {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toBeInTheDocument()
		);
		expect(screen.getByTestId("health-badge-dot")).toHaveClass("bg-success");

		// --- element-panel slot: the real NodeEditDialog grows an "Evidence"
		// tab and renders the real HealthPanel's evidence log inside it ---
		const user = userEvent.setup();
		render(
			<NodeEditDialog
				node={PROPERTY_NODE}
				nodeType="property"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		await waitFor(() =>
			expect(screen.getByRole("tablist")).toBeInTheDocument()
		);
		expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
		const evidenceTab = screen.getByRole("tab", { name: "Evidence" });
		await user.click(evidenceTab);

		await waitFor(() =>
			expect(screen.getByTestId("health-evidence-log")).toBeInTheDocument()
		);
		expect(screen.getByText("0.97 ratio")).toBeInTheDocument();
		expect(screen.getByText("Pass")).toBeInTheDocument();
	});
});
