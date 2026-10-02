import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	CLAIM_CONTEXT,
	installFakeEventSource,
	serveHealth,
} from "@/src/__tests__/utils/health-criteria-harness";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
} from "../health-types";
import { INTEGRATION, storedCriteria } from "./criteria-test-data";

vi.mock("@radix-ui/react-select", async () => {
	return await vi.importActual("@radix-ui/react-select");
});
vi.mock("@radix-ui/react-radio-group", async () => {
	return await vi.importActual("@radix-ui/react-radio-group");
});

beforeEach(() => {
	installFakeEventSource();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const IMAGE_MARKUP = "<img src=x onerror=alert(1)>";
const SCRIPT_MARKUP = "<script>alert(2)</script>";
const SCRIPT_ADDRESS = "javascript:alert(3)";
const RIGHT_TO_LEFT = "فحص الختم בדיקת איכות";
const LONG_WORD = "W".repeat(2000);
const LONG_NAME = `N${"x".repeat(199)}`;
const WRAPPING_CLASS = /wrap-anywhere|break-words|break-all/;
const ELEMENTS_THAT_MUST_NOT_APPEAR = "img, script, iframe, object, embed, a";

const HOSTILE_CHECK: HealthCheck = {
	name: `${IMAGE_MARKUP} ${LONG_NAME}`,
	version: `v${SCRIPT_MARKUP}`,
	description: `${SCRIPT_MARKUP} ${SCRIPT_ADDRESS} ${RIGHT_TO_LEFT} ${LONG_WORD}`,
	scope: "widget",
	scope_label: { one: `${IMAGE_MARKUP}one`, many: `${SCRIPT_MARKUP}many` },
	value: { type: "number", unit: `${IMAGE_MARKUP}mm` },
	params: [
		{
			key: "profile",
			label: `${IMAGE_MARKUP} ${LONG_WORD}`,
			type: "enum",
			options: [
				`${IMAGE_MARKUP}first`,
				`${SCRIPT_MARKUP}second`,
				RIGHT_TO_LEFT,
			],
			default: `${IMAGE_MARKUP}first`,
		},
		{ key: "note", label: SCRIPT_ADDRESS, type: "string", unit: SCRIPT_MARKUP },
	],
	recommended: {
		rule: {
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 1, marginal_values: 2 },
		},
		aggregation: {
			kind: "proportion",
			params: { threshold: 0.9, use_verdict: true },
		},
		window: "PT5M",
		valid_for: "PT5M",
	},
};

function hostileView(
	overrides: Partial<HealthCriteriaResponse> = {}
): HealthCriteriaResponse {
	const base = storedCriteria();
	if (!base.criteria) {
		throw new Error("no settings");
	}
	return {
		...base,
		check_description: HOSTILE_CHECK,
		criteria: {
			...base.criteria,
			check: {
				name: HOSTILE_CHECK.name,
				version: HOSTILE_CHECK.version,
				scope: "widget",
				params: { profile: `${IMAGE_MARKUP}first`, note: SCRIPT_ADDRESS },
			},
			rule: {
				kind: "threshold",
				direction: "minimize",
				params: { pass_values: 1, marginal_values: 2 },
				version: "r1",
			},
			reduction: undefined,
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9, use_verdict: true },
				version: "a1",
			},
		},
		accepted_by: {
			name: `${IMAGE_MARKUP}${LONG_WORD}`,
			owns_integration: true,
		},
		last_change: {
			action: "accepted",
			by_name: `${SCRIPT_MARKUP}Alice`,
			at: "2026-10-02T09:00:00.000Z",
			reason: `${IMAGE_MARKUP} ${RIGHT_TO_LEFT}`,
		},
		...overrides,
	};
}

async function openSettings(
	view: HealthCriteriaResponse,
	lists: HealthCheckListOffer[] = [],
	canEdit = true
) {
	serveHealth({ lists, view });
	const user = userEvent.setup();
	const rendered = render(
		<HealthPanel
			{...CLAIM_CONTEXT}
			canEdit={canEdit}
			elementText={`${IMAGE_MARKUP} claim ${SCRIPT_ADDRESS}`}
		/>,
		{ withProviders: false }
	);
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	const panel = screen.getByRole("tabpanel", { name: "Settings" });
	await within(panel).findByTestId("health-plain-words");
	return { ...rendered, panel, user };
}

function wrapsWithin(element: HTMLElement): boolean {
	for (
		let node: HTMLElement | null = element;
		node;
		node = node.parentElement
	) {
		if (WRAPPING_CLASS.test(node.className)) {
			return true;
		}
		if (node.getAttribute("role") === "tabpanel") {
			return false;
		}
	}
	return false;
}

describe("text from a pipeline in the accepted settings form", () => {
	it("renders every pipeline and person string as text, never as an element or a link", async () => {
		const { panel } = await openSettings(hostileView());
		expect(panel.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)).toHaveLength(
			0
		);
		expect(
			within(panel).getByTestId("health-accepted-line").textContent
		).toContain(`${IMAGE_MARKUP}${LONG_WORD}`);
		expect(
			within(panel).getByTestId("health-claim-text").textContent
		).toContain(`${IMAGE_MARKUP} claim ${SCRIPT_ADDRESS}`);
	});

	it("shows the check's description exactly as given beside 'Measures', wrapped", async () => {
		const { panel } = await openSettings(hostileView());
		const description = HOSTILE_CHECK.description ?? "";
		const row = within(panel).getByText(description);
		expect(row.tagName).toBe("DD");
		expect(row.textContent).toBe(description);
		expect(wrapsWithin(row)).toBe(true);
	});

	it("shows the parameter labels and the unit as text and wraps a very long label", async () => {
		const { panel } = await openSettings(hostileView());
		const label = within(panel).getByText(`${IMAGE_MARKUP} ${LONG_WORD}`);
		expect(label.tagName).toBe("LABEL");
		expect(wrapsWithin(label)).toBe(true);
		expect(within(panel).getByLabelText(SCRIPT_ADDRESS)).toBeVisible();
		expect(within(panel).getByText(SCRIPT_MARKUP)).toBeVisible();
	});

	it("shows the plain-words summary with the description quoted as text", async () => {
		const { panel } = await openSettings(hostileView());
		const summary = within(panel).getByTestId("health-plain-words");
		expect(summary.textContent).toContain(HOSTILE_CHECK.description);
		expect(
			summary.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)
		).toHaveLength(0);
		for (const item of summary.querySelectorAll("li")) {
			expect(wrapsWithin(item as HTMLElement)).toBe(true);
		}
	});

	it("shows option names as text when the select is opened", async () => {
		const { panel, user } = await openSettings(hostileView());
		const trigger = within(panel).getByLabelText(
			`${IMAGE_MARKUP} ${LONG_WORD}`
		);
		await user.click(trigger);
		const options = await screen.findAllByRole("option");
		expect(options.map((option) => option.textContent)).toEqual([
			`${IMAGE_MARKUP}first`,
			`${SCRIPT_MARKUP}second`,
			RIGHT_TO_LEFT,
		]);
		expect(
			document.body.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)
		).toHaveLength(0);
		for (const option of options) {
			expect(wrapsWithin(option)).toBe(true);
		}
	});

	it("shows the name of a check and of its pipeline as text in the picker", async () => {
		const list: HealthCheckListOffer = {
			integration: INTEGRATION,
			pipeline: `${IMAGE_MARKUP} pipeline ${LONG_WORD}`,
			published_at: "2026-10-02T08:00:00.000Z",
			checks: [HOSTILE_CHECK, { ...HOSTILE_CHECK, name: "Second Check" }],
		};
		const second: HealthCheckListOffer = {
			integration: { id: "integration-2", name: "Other" },
			pipeline: `${SCRIPT_MARKUP} second pipeline`,
			published_at: "2026-10-02T08:00:00.000Z",
			checks: [{ ...HOSTILE_CHECK, name: "Third Check" }],
		};
		const none: HealthCriteriaResponse = {
			criteria: null,
			check_description: null,
			integration: null,
			accepted_by: null,
			last_change: null,
			pipeline_read: null,
			check_offer: null,
			latest_result: null,
		};
		serveHealth({ lists: [list, second], view: none });
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await user.click(await screen.findByRole("tab", { name: "Settings" }));
		const panel = screen.getByRole("tabpanel", { name: "Settings" });
		await user.click(
			await within(panel).findByRole("combobox", { name: "Check" })
		);
		const options = await screen.findAllByRole("option");
		expect(options.map((option) => option.textContent)).toContain(
			HOSTILE_CHECK.name
		);
		expect(
			await screen.findByText(`${IMAGE_MARKUP} pipeline ${LONG_WORD}`)
		).toBeVisible();
		expect(screen.getByText(`${SCRIPT_MARKUP} second pipeline`)).toBeVisible();
		expect(
			document.body.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)
		).toHaveLength(0);
	});

	it("shows a person's name and a stopping reason as text, wrapped", async () => {
		const view = storedCriteria({ state: "inactive" });
		const { panel } = await (async () => {
			serveHealth({
				lists: [],
				view: {
					...view,
					last_change: {
						action: "retired",
						by_name: `${IMAGE_MARKUP}${LONG_WORD}`,
						at: "2026-10-02T09:00:00.000Z",
						reason: `${SCRIPT_MARKUP} ${RIGHT_TO_LEFT} ${LONG_WORD}`,
					},
				},
			});
			const user = userEvent.setup();
			render(<HealthPanel {...CLAIM_CONTEXT} canEdit={false} />, {
				withProviders: false,
			});
			await user.click(await screen.findByRole("tab", { name: "Settings" }));
			const tabpanel = screen.getByRole("tabpanel", { name: "Settings" });
			await within(tabpanel).findByTestId("health-stopped-line");
			return { panel: tabpanel };
		})();
		const line = within(panel).getByTestId("health-stopped-line");
		expect(line.textContent).toContain(`${IMAGE_MARKUP}${LONG_WORD}`);
		expect(line.textContent).toContain(`${SCRIPT_MARKUP} ${RIGHT_TO_LEFT}`);
		expect(wrapsWithin(line)).toBe(true);
		expect(panel.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)).toHaveLength(
			0
		);
	});

	it("shows hostile text in the footer's difference lines as text", async () => {
		const { panel } = await openSettings(
			hostileView({
				latest_result: {
					record_id: "r1",
					differences: [
						{
							field: "check.version",
							declared: `v${SCRIPT_MARKUP}`,
							used: IMAGE_MARKUP,
						},
						{ field: `${IMAGE_MARKUP}.field`, declared: 1, used: 2 },
					],
				},
			})
		);
		const footer = within(panel).getByTestId("health-settings-footer");
		expect(footer.textContent).toContain(IMAGE_MARKUP);
		expect(footer.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)).toHaveLength(
			0
		);
		for (const line of footer.querySelectorAll("p")) {
			expect(wrapsWithin(line as HTMLElement)).toBe(true);
		}
	});

	it("keeps a viewer's view of hostile text as text too", async () => {
		const { panel } = await openSettings(hostileView(), [], false);
		expect(panel.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)).toHaveLength(
			0
		);
	});
});

describe("text from a pipeline in the results lines", () => {
	it("shows mismatch lines as text", async () => {
		serveHealth({
			lists: [],
			view: hostileView(),
			status: {
				bound_check: IMAGE_MARKUP,
				expires_at: null,
				mismatch: {
					state: "mismatch",
					differences: [
						{
							field: "rule.version",
							declared: IMAGE_MARKUP,
							used: SCRIPT_MARKUP,
						},
					],
				},
				record_id: "r1",
				rejected_since_last_accept: 0,
				stale: false,
				stale_reason: null,
				stale_since: null,
				timestamp: "2026-10-02T09:00:00.000Z",
				verdict: "pass",
			},
		});
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const lines = await screen.findByTestId("health-mismatch-lines");
		expect(lines.textContent).toContain(
			`${SCRIPT_MARKUP}; the settings say ${IMAGE_MARKUP}`
		);
		expect(
			document.body.querySelectorAll(ELEMENTS_THAT_MUST_NOT_APPEAR)
		).toHaveLength(0);
	});
});
