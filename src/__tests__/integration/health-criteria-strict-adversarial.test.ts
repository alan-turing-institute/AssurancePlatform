import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	appendRecord,
	callReinstate,
	callRevoke,
	importMachineRoute,
	machineGet,
} from "../utils/health-adversarial-kit";
import {
	criteriaWorld,
	itemSettingsWith,
	numericSettings,
	save,
	systemSettings,
} from "../utils/health-criteria-adversarial-kit";
import {
	callCaseChecks,
	callCriteriaPut,
	callHygiene,
	callPublishChecks,
	callRetirement,
	itemSettings,
	saveBody,
} from "../utils/health-criteria-kit";
import { createTestElement } from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

async function setup() {
	const world = await criteriaWorld();
	await mockAuth(world.owner.id, world.owner.username, world.owner.email);
	return world;
}

type Json = Record<string, any>;

async function revisionCount(claimId: string) {
	return await prisma.pluginHealthCriteriaRevision.count({
		where: { claimId },
	});
}

/** Publishes a custom list, then returns it. */
async function publish(secret: string, mutate: (list: Json) => void) {
	const list = buildHealthCheckList() as Json;
	mutate(list);
	const response = await callPublishChecks(list, secret);
	return { response, list, body: await response.json() };
}

/** A check list holding one check of each odd shape the strict checks care about. */
function oddChecks(list: Json) {
	list.checks = [
		{
			name: "Typed Check",
			version: "1",
			scope: "item",
			value: { type: "boolean" },
			params: [
				{ key: "s", label: "S", type: "string" },
				{ key: "n", label: "N", type: "number" },
				{ key: "b", label: "B", type: "boolean" },
				{ key: "d", label: "D", type: "duration" },
				{ key: "e", label: "E", type: "enum", options: ["x", "y"] },
			],
		},
		{
			name: "Text Reader",
			version: "1",
			scope: "item",
			value: { type: "string" },
		},
		{
			name: "Clock Reader",
			version: "1",
			scope: "item",
			value: { type: "datetime" },
		},
		{
			name: "Number Reader",
			version: "1",
			scope: "item",
			value: { type: "number", unit: "mm" },
		},
		...(buildHealthCheckList() as Json).checks,
	];
}

const BASE_TIMING = { window: "PT1M", valid_for: "PT5M" };
const AGG = {
	kind: "proportion",
	params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
};

function typed(overrides: Json = {}, params: Json = {}) {
	return {
		check: {
			name: "Typed Check",
			version: "1",
			scope: "item",
			params,
		},
		rule: { kind: "identity" },
		aggregation: AGG,
		...BASE_TIMING,
		...overrides,
	};
}

function numberReader(overrides: Json = {}) {
	return {
		check: { name: "Number Reader", version: "1", scope: "item" },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 10, marginal_values: 5 },
		},
		aggregation: AGG,
		...BASE_TIMING,
		...overrides,
	};
}

function textReader(overrides: Json = {}) {
	return {
		check: { name: "Text Reader", version: "1", scope: "item" },
		rule: { kind: "membership", params: { pass_values: ["OK"] } },
		aggregation: AGG,
		...BASE_TIMING,
		...overrides,
	};
}

async function refused(
	claimId: string,
	integrationId: string,
	settings: Json,
	field: string
) {
	const response = await callCriteriaPut(
		claimId,
		saveBody(integrationId, settings, true)
	);
	const body = await response.json();
	return { status: response.status, text: JSON.stringify(body), field, body };
}

describe("strict settings: every refusal names its field and stores nothing", () => {
	const cases: [string, () => Json, string][] = [
		[
			"a yes-or-no check judged by a threshold rule",
			() =>
				itemSettingsWith((s) => {
					s.rule = {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 1, marginal_values: 0 },
					};
				}),
			"settings.rule.kind",
		],
		[
			"a numeric check judged by an identity rule",
			() => numberReader({ rule: { kind: "identity" } }),
			"settings.rule.kind",
		],
		[
			"a text check judged by a threshold rule",
			() =>
				textReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 1 },
					},
				}),
			"settings.rule.kind",
		],
		[
			"a date-and-time check",
			() => ({
				check: { name: "Clock Reader", version: "1", scope: "item" },
				rule: { kind: "identity" },
				aggregation: AGG,
				...BASE_TIMING,
			}),
			"settings.rule.kind",
		],
		[
			"direction target",
			() =>
				numberReader({
					rule: {
						kind: "threshold",
						direction: "target",
						params: { pass_values: 10 },
					},
				}),
			"settings.rule.direction",
		],
		[
			"a threshold rule with no direction",
			() =>
				numberReader({
					rule: { kind: "threshold", params: { pass_values: 10 } },
				}),
			"settings.rule.direction",
		],
		[
			"a worst-of aggregation",
			() =>
				numberReader({
					aggregation: { kind: "worst-of", params: { use_verdict: true } },
				}),
			"settings.aggregation.kind",
		],
		[
			"a percentile aggregation",
			() =>
				numberReader({
					aggregation: {
						kind: "percentile",
						params: { percentile: 90, use_verdict: true },
					},
				}),
			"settings.aggregation.kind",
		],
		[
			"use_verdict false",
			() =>
				numberReader({
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.9, use_verdict: false },
					},
				}),
			"settings.aggregation.params.use_verdict",
		],
		[
			"use_verdict missing",
			() =>
				numberReader({
					aggregation: { kind: "proportion", params: { threshold: 0.9 } },
				}),
			"settings.aggregation.params.use_verdict",
		],
		[
			"a claim-level marginal threshold",
			() =>
				numberReader({
					aggregation: {
						kind: "proportion",
						params: {
							threshold: 0.9,
							marginal_threshold: 0.5,
							use_verdict: true,
						},
					},
				}),
			"settings.aggregation.params.marginal_threshold",
		],
		[
			"a claim-level threshold above 1",
			() =>
				numberReader({
					aggregation: {
						kind: "proportion",
						params: { threshold: 1.01, use_verdict: true },
					},
				}),
			"settings.aggregation.params.threshold",
		],
		[
			"a claim-level threshold below 0",
			() =>
				numberReader({
					aggregation: {
						kind: "proportion",
						params: { threshold: -0.01, use_verdict: true },
					},
				}),
			"settings.aggregation.params.threshold",
		],
		[
			"an aggregation availability floor above 1",
			() =>
				numberReader({
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.5, avail_floor: 2, use_verdict: true },
					},
				}),
			"settings.aggregation.params.avail_floor",
		],
		[
			"no aggregation on a per-item check",
			() => numberReader({ aggregation: undefined }),
			"settings.aggregation",
		],
		[
			"a reduction on a whole-system check",
			() =>
				systemSettings({
					reduction: { kind: "mean", params: {} },
				}),
			"settings.reduction",
		],
		[
			"an aggregation on a whole-system check",
			() => systemSettings({ aggregation: AGG }),
			"settings.aggregation",
		],
		[
			"a yes-or-no rule with an averaging reduction and no rule of its own",
			() =>
				itemSettingsWith((s) => {
					s.reduction = { kind: "mean", params: { avail_floor: 0.8 } };
				}),
			"settings.reduction.rule",
		],
		[
			"a yes-or-no rule with a sum reduction and no rule of its own",
			() =>
				itemSettingsWith((s) => {
					s.reduction = { kind: "sum" };
				}),
			"settings.reduction.rule",
		],
		[
			"a yes-or-no rule with a median reduction and no rule of its own",
			() =>
				itemSettingsWith((s) => {
					s.reduction = { kind: "median" };
				}),
			"settings.reduction.rule",
		],
		[
			"a yes-or-no rule with a percentile reduction and no rule of its own",
			() =>
				itemSettingsWith((s) => {
					s.reduction = { kind: "percentile", params: { p: 50 } };
				}),
			"settings.reduction.rule",
		],
		[
			"a membership rule on numbers with a mean reduction and no rule of its own",
			() =>
				numberReader({
					rule: { kind: "membership", params: { pass_values: [1, 2] } },
					reduction: { kind: "mean" },
				}),
			"settings.reduction.rule",
		],
		[
			"any reduction on a check that returns text",
			() => textReader({ reduction: { kind: "last" } }),
			"settings.reduction",
		],
		[
			"a reduction's own rule that is an identity rule",
			() =>
				itemSettingsWith((s) => {
					s.reduction.rule = { kind: "identity" };
				}),
			"settings.reduction.rule.kind",
		],
		[
			"a reduction's own rule with direction target",
			() =>
				itemSettingsWith((s) => {
					s.reduction.rule = {
						kind: "threshold",
						direction: "target",
						params: { pass_values: 0.8 },
					};
				}),
			"settings.reduction.rule.direction",
		],
		[
			"a percentile reduction with no p",
			() =>
				itemSettingsWith((s) => {
					s.reduction = {
						kind: "percentile",
						params: {},
						rule: s.reduction.rule,
					};
				}),
			"settings.reduction.params.p",
		],
		[
			"a percentile reduction with p above 100",
			() =>
				itemSettingsWith((s) => {
					s.reduction = {
						kind: "percentile",
						params: { p: 100.5 },
						rule: s.reduction.rule,
					};
				}),
			"settings.reduction.params.p",
		],
		[
			"a percentile reduction with negative p",
			() =>
				itemSettingsWith((s) => {
					s.reduction = {
						kind: "percentile",
						params: { p: -1 },
						rule: s.reduction.rule,
					};
				}),
			"settings.reduction.params.p",
		],
		[
			"a reduction availability floor above 1",
			() =>
				itemSettingsWith((s) => {
					s.reduction.params.avail_floor = 1.2;
				}),
			"settings.reduction.params.avail_floor",
		],
		[
			"a setting the check does not describe",
			() => typed({}, { unknown_key: "x" }),
			"settings.check.params.unknown_key",
		],
		[
			"a prototype key in check settings",
			() => JSON.parse('{"x":1}') && typed({}, JSON.parse('{"__proto__":"x"}')),
			"settings.check.params.__proto__",
		],
		[
			"a check setting named constructor",
			() => typed({}, { constructor: "x" }),
			"settings.check.params.constructor",
		],
		[
			"a check setting named toString",
			() => typed({}, { toString: "x" }),
			"settings.check.params.toString",
		],
		[
			"a string setting given a number",
			() => typed({}, { s: 5 }),
			"settings.check.params.s",
		],
		[
			"a number setting given text",
			() => typed({}, { n: "5" }),
			"settings.check.params.n",
		],
		[
			"a boolean setting given text",
			() => typed({}, { b: "true" }),
			"settings.check.params.b",
		],
		[
			"a duration setting given months",
			() => typed({}, { d: "P1M" }),
			"settings.check.params.d",
		],
		[
			"an enum setting given a value outside its options",
			() => typed({}, { e: "z" }),
			"settings.check.params.e",
		],
		[
			"a window in months",
			() => itemSettingsWith((s) => (s.window = "P1M")),
			"settings.window",
		],
		[
			"a window in years",
			() => itemSettingsWith((s) => (s.window = "P1Y")),
			"settings.window",
		],
		[
			"a validity in months",
			() => itemSettingsWith((s) => (s.valid_for = "P3M")),
			"settings.valid_for",
		],
		[
			"a window just over 100 years",
			() => itemSettingsWith((s) => (s.window = "P36501D")),
			"settings.window",
		],
		[
			"a validity just over 100 years",
			() => itemSettingsWith((s) => (s.valid_for = "P5215W")),
			"settings.valid_for",
		],
		[
			"a zero window",
			() => itemSettingsWith((s) => (s.window = "PT0S")),
			"settings.window",
		],
		[
			"a window that is indefinite",
			() => itemSettingsWith((s) => (s.window = "indefinite")),
			"settings.window",
		],
		[
			"a missing window",
			() => itemSettingsWith((s) => (s.window = undefined)),
			"settings.window",
		],
		[
			"a missing validity",
			() => itemSettingsWith((s) => (s.valid_for = undefined)),
			"settings.valid_for",
		],
		[
			"a whole-system check with no window",
			() => systemSettings({ window: undefined }),
			"settings.window",
		],
		[
			"a threshold whose marginal limit equals its pass limit (maximize)",
			() =>
				numberReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 10, marginal_values: 10 },
					},
				}),
			"settings.rule.params.marginal_values",
		],
		[
			"a threshold whose marginal limit equals its pass limit (minimize)",
			() =>
				numberReader({
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 10, marginal_values: 10 },
					},
				}),
			"settings.rule.params.marginal_values",
		],
		[
			"a maximize threshold whose marginal limit is above its pass limit",
			() =>
				numberReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 10, marginal_values: 11 },
					},
				}),
			"settings.rule.params.marginal_values",
		],
		[
			"a minimize threshold whose marginal limit is below its pass limit",
			() =>
				numberReader({
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 10, marginal_values: 9 },
					},
				}),
			"settings.rule.params.marginal_values",
		],
		[
			"a band with low above high",
			() =>
				numberReader({
					rule: { kind: "band", params: { pass_values: [8, 2] } },
				}),
			"settings.rule.params.pass_values",
		],
		[
			"a band whose marginal band has low above high",
			() =>
				numberReader({
					rule: {
						kind: "band",
						params: { pass_values: [4, 6], marginal_values: [9, 1] },
					},
				}),
			"settings.rule.params.marginal_values",
		],
		[
			"a band whose marginal band does not contain the pass band",
			() =>
				numberReader({
					rule: {
						kind: "band",
						params: { pass_values: [2, 8], marginal_values: [3, 7] },
					},
				}),
			"settings.rule.params.marginal_values",
		],
		[
			"a band with a pair of the wrong length",
			() =>
				numberReader({
					rule: { kind: "band", params: { pass_values: [1, 2, 3] } },
				}),
			"settings.rule.params.pass_values",
		],
		[
			"a membership rule with an empty list",
			() =>
				textReader({
					rule: { kind: "membership", params: { pass_values: [] } },
				}),
			"settings.rule.params.pass_values",
		],
		[
			"a threshold with a text limit",
			() =>
				numberReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: "10" },
					},
				}),
			"settings.rule.params.pass_values",
		],
		[
			"an unknown key in the settings",
			() => numberReader({ extra: true }),
			"extra",
		],
		[
			"an unknown key in the rule",
			() => numberReader({ rule: { ...numberReader().rule, extra: 1 } }),
			"extra",
		],
		[
			"a version label sent by the browser",
			() => numberReader({ rule: { ...numberReader().rule, version: "r7" } }),
			"version",
		],
		[
			"an unknown key in the check block",
			() => ({
				...numberReader(),
				check: { ...numberReader().check, extra: 1 },
			}),
			"extra",
		],
		[
			"a check block with edge whitespace",
			() => ({
				...numberReader(),
				check: { ...numberReader().check, version: " 1" },
			}),
			"version",
		],
		[
			"a scope that differs from the list's",
			() => ({
				...numberReader(),
				check: { ...numberReader().check, scope: "environment" },
			}),
			"settings.check.scope",
		],
	];

	it.each(cases)("refuses %s", async (_name, build, field) => {
		const { claim, integration, secret } = await setup();
		await publish(secret, oddChecks);
		const result = await refused(claim.id, integration.id, build(), field);
		expect(result.status).toBe(400);
		expect(result.text).toContain(field);
		expect(await revisionCount(claim.id)).toBe(0);
		expect(
			await prisma.pluginHealthCriteria.count({ where: { claimId: claim.id } })
		).toBe(0);
		expect(
			await prisma.pluginHealthClaimState.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
	});

	it("never stores a prototype key sent in check settings, and does not pollute the prototype", async () => {
		const { claim, integration, secret } = await setup();
		await publish(secret, oddChecks);
		const body = JSON.stringify(
			saveBody(integration.id, typed({}, { s: "ok" }), true)
		).replace('"s":"ok"', '"s":"ok","__proto__":{"polluted":"yes"}');
		const response = await callCriteriaPut(claim.id, body);
		expect(({} as Json).polluted).toBeUndefined();
		const row = await prisma.pluginHealthCriteria.findUnique({
			where: { claimId: claim.id },
		});
		if (response.status === 200) {
			const params = (row?.settings as Json).check.params as Json;
			expect(Object.hasOwn(params, "__proto__")).toBe(false);
			expect(params.polluted).toBeUndefined();
		} else {
			expect(response.status).toBe(400);
		}
	});

	it("applies the same checks to a suggestion as to an acceptance", async () => {
		const { claim, integration, secret } = await setup();
		await publish(secret, oddChecks);
		const response = await callCriteriaPut(
			claim.id,
			saveBody(integration.id, numberReader({ window: "P1M" }), false)
		);
		expect(response.status).toBe(400);
		expect(await revisionCount(claim.id)).toBe(0);
	});

	it("accepts the boundary cases that are legal", async () => {
		const { claim, integration, secret } = await setup();
		await publish(secret, oddChecks);
		const legal: [string, Json][] = [
			[
				"a window of exactly 100 years",
				itemSettingsWith((s) => (s.window = "P36500D")),
			],
			[
				"a validity of exactly 100 years in weeks",
				itemSettingsWith((s) => (s.valid_for = "P5214W")),
			],
			[
				"an indefinite validity",
				itemSettingsWith((s) => (s.valid_for = "indefinite")),
			],
			[
				"a yes-or-no rule with a max reduction and no rule of its own",
				itemSettingsWith((s) => {
					s.reduction = { kind: "max" };
				}),
			],
			[
				"a yes-or-no rule with a last reduction and no rule of its own",
				itemSettingsWith((s) => {
					s.reduction = { kind: "last" };
				}),
			],
			[
				"a numeric check with a band whose marginal band is wider",
				numberReader({
					rule: {
						kind: "band",
						params: { pass_values: [4, 6], marginal_values: [2, 8] },
					},
				}),
			],
			[
				"a membership rule on numbers",
				numberReader({
					rule: { kind: "membership", params: { pass_values: [1, 2] } },
				}),
			],
			["a text check with no reduction", textReader()],
			[
				"every typed setting",
				typed({}, { s: "a", n: 1.5, b: false, d: "PT5M", e: "y" }),
			],
			["a whole-system check", systemSettings()],
			[
				"a percentile reduction with p at 0 and its own rule",
				itemSettingsWith((s) => {
					s.reduction = {
						kind: "percentile",
						params: { p: 0 },
						rule: s.reduction.rule,
					};
				}),
			],
		];
		for (const [name, settings] of legal) {
			const result = await save(claim.id, integration.id, settings, false);
			expect(result.status, `${name}: ${JSON.stringify(result.body)}`).toBe(
				200
			);
			await callRetirement(claim.id, {});
		}
	});

	it("refuses numbers that are not finite", async () => {
		const { claim, integration, secret } = await setup();
		await publish(secret, oddChecks);
		const body = JSON.stringify(
			saveBody(
				integration.id,
				numberReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: "__INF__" },
					},
				}),
				true
			)
		).replace('"__INF__"', "1e999");
		const response = await callCriteriaPut(claim.id, body);
		expect(response.status).toBe(400);
		const negative = JSON.stringify(
			saveBody(
				integration.id,
				numberReader({
					aggregation: {
						kind: "proportion",
						params: { threshold: "__INF__", use_verdict: true },
					},
				}),
				true
			)
		).replace('"__INF__"', "-1e999");
		expect((await callCriteriaPut(claim.id, negative)).status).toBe(400);
		const inBand = JSON.stringify(
			saveBody(
				integration.id,
				numberReader({
					rule: { kind: "band", params: { pass_values: ["__INF__", 3] } },
				}),
				true
			)
		).replace('"__INF__"', "-1e999");
		expect((await callCriteriaPut(claim.id, inBand)).status).toBe(400);
		expect(await revisionCount(claim.id)).toBe(0);
	});

	it("refuses text with a NUL or an unpaired surrogate anywhere in settings", async () => {
		const { claim, integration, secret } = await setup();
		await publish(secret, oddChecks);
		const bad = ["a\u0000b", "x\ud800y", "\udc00"];
		for (const text of bad) {
			const variants: Json[] = [
				typed({}, { s: text }),
				numberReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 10, note: text },
					},
				}),
				numberReader({
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.9, use_verdict: true, note: text },
					},
				}),
				numberReader({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 10, [`k${text}`]: 1 },
					},
				}),
				itemSettingsWith((s) => {
					s.reduction.params.note = text;
				}),
				itemSettingsWith((s) => {
					s.reduction.rule.params.note = [text];
				}),
			];
			for (const settings of variants) {
				const response = await callCriteriaPut(
					claim.id,
					saveBody(integration.id, settings, true)
				);
				expect(response.status, JSON.stringify(settings)).toBe(400);
			}
		}
		expect(await revisionCount(claim.id)).toBe(0);
	});

	it("refuses a retirement reason with a NUL or an unpaired surrogate, and one that is too long", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		for (const reason of ["a\u0000b", "x\ud800", "y".repeat(5000)]) {
			const response = await callRetirement(claim.id, { reason });
			expect(response.status).toBe(400);
			expect(JSON.stringify(await response.json())).toContain("reason");
		}
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(row.state).toBe("ACCEPTED");
		expect(await revisionCount(claim.id)).toBe(1);
	});

	it("refuses an unknown key and a wrong type in the request body itself", async () => {
		const { claim, integration } = await setup();
		for (const body of [
			{ integration_id: integration.id, settings: itemSettings() },
			{
				integration_id: integration.id,
				settings: itemSettings(),
				accept: "yes",
			},
			{ integration_id: "nope", settings: itemSettings(), accept: true },
			{ settings: itemSettings(), accept: true },
			{ integration_id: integration.id, accept: true },
			[],
			"text",
		]) {
			const response = await callCriteriaPut(claim.id, body);
			expect(response.status).toBe(400);
		}
		const empty = await callCriteriaPut(claim.id, "");
		expect(empty.status).toBe(400);
		const broken = await callCriteriaPut(claim.id, "{not json");
		expect(broken.status).toBe(400);
		expect(await revisionCount(claim.id)).toBe(0);
	});

	it("lets later edits stand when the check has left the list, but refuses a change of check", async () => {
		const { claim, integration, secret } = await setup();
		await save(claim.id, integration.id);
		const list = buildHealthCheckList() as Json;
		list.checks = list.checks.filter(
			(entry: Json) => entry.name !== ITEM_CHECK_NAME
		);
		await callPublishChecks(list, secret);
		const edit = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT2M";
			})
		);
		expect(edit.status).toBe(200);
		const moved = await save(claim.id, integration.id, numericSettings());
		expect(moved.status).toBe(200);
		const movedBack = await save(claim.id, integration.id);
		expect(movedBack.status).toBe(400);
		const versionMove = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.check.version = "7";
			})
		);
		expect(versionMove.status).toBe(400);
	});
});

describe("publishing a check list", () => {
	const named = (n: number) => ({
		name: `Check ${n}`,
		version: "1",
		scope: "item",
		value: { type: "boolean" },
	});

	it("accepts 200 checks and refuses 201, naming the field", async () => {
		const { secret } = await setup();
		const two = await callPublishChecks(
			{
				pipeline: "P",
				checks: Array.from({ length: 200 }, (_, i) => named(i)),
			},
			secret
		);
		expect(two.status).toBe(200);
		expect((await two.json()).checks).toBe(200);
		const over = await callPublishChecks(
			{
				pipeline: "P",
				checks: Array.from({ length: 201 }, (_, i) => named(i)),
			},
			secret
		);
		expect(over.status).toBe(400);
		expect(JSON.stringify(await over.json())).toContain("checks");
	});

	it("keeps the previous list when a publish is refused", async () => {
		const { secret, owner, testCase } = await setup();
		await mockAuth(owner.id);
		const refusedPublish = await callPublishChecks(
			{
				pipeline: "P",
				checks: Array.from({ length: 201 }, (_, i) => named(i)),
			},
			secret
		);
		expect(refusedPublish.status).toBe(400);
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists[0].checks).toHaveLength(3);
	});

	it("accepts a body of exactly 256 KB and refuses one byte more with a 413", async () => {
		const { secret } = await setup();
		const base = JSON.stringify({ pipeline: "P", checks: [named(1)] });
		const cap = 256 * 1024;
		const atCap = base + " ".repeat(cap - Buffer.byteLength(base));
		expect(Buffer.byteLength(atCap)).toBe(cap);
		expect((await callPublishChecks(atCap, secret)).status).toBe(200);
		const over = `${atCap} `;
		expect((await callPublishChecks(over, secret)).status).toBe(413);
	});

	it("counts bytes rather than characters for the size limit", async () => {
		const { secret } = await setup();
		const checks = Array.from({ length: 70 }, (_, i) => ({
			...named(i),
			description: "é".repeat(1900),
		}));
		const body = JSON.stringify({ pipeline: "P", checks });
		expect(body.length).toBeLessThan(256 * 1024);
		expect(Buffer.byteLength(body)).toBeGreaterThan(256 * 1024);
		expect((await callPublishChecks(body, secret)).status).toBe(413);
	});

	it("refuses a duplicate check name, and names with edge whitespace", async () => {
		const { secret } = await setup();
		const dup = await callPublishChecks(
			{ pipeline: "P", checks: [named(1), named(1)] },
			secret
		);
		expect(dup.status).toBe(400);
		expect(JSON.stringify(await dup.json())).toContain("checks.1.name");
		for (const edit of [
			(c: Json) => (c.name = " lead"),
			(c: Json) => (c.name = "trail "),
			(c: Json) => (c.version = " 1"),
			(c: Json) => (c.version = "1 "),
			(c: Json) => (c.scope = " item"),
			(c: Json) => (c.scope = "item\n"),
			(c: Json) => (c.name = "\tTabbed"),
			(c: Json) => (c.name = ""),
		]) {
			const check = named(1) as Json;
			edit(check);
			const response = await callPublishChecks(
				{ pipeline: "P", checks: [check] },
				secret
			);
			expect(response.status).toBe(400);
		}
	});

	it("refuses an unknown key at each level", async () => {
		const { secret } = await setup();
		const richCheck = () =>
			({
				name: "C",
				version: "1",
				scope: "item",
				scope_label: { one: "a", many: "b" },
				value: { type: "number", unit: "mm" },
				params: [{ key: "k", label: "K", type: "string" }],
				recommended: {
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 1 },
					},
					reduction: {
						kind: "mean",
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 1 },
						},
					},
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.5, use_verdict: true },
					},
					window: "PT1M",
					valid_for: "PT5M",
				},
			}) as Json;
		const ok = await callPublishChecks(
			{ pipeline: "P", checks: [richCheck()] },
			secret
		);
		expect(ok.status).toBe(200);
		const mutations: [string, (list: Json) => void][] = [
			["top level", (l) => (l.extra = 1)],
			["check", (l) => (l.checks[0].extra = 1)],
			["value", (l) => (l.checks[0].value.extra = 1)],
			["scope_label", (l) => (l.checks[0].scope_label.extra = 1)],
			["param spec", (l) => (l.checks[0].params[0].extra = 1)],
			["recommended", (l) => (l.checks[0].recommended.extra = 1)],
			["recommended rule", (l) => (l.checks[0].recommended.rule.extra = 1)],
			[
				"recommended reduction",
				(l) => (l.checks[0].recommended.reduction.extra = 1),
			],
			[
				"recommended reduction rule",
				(l) => (l.checks[0].recommended.reduction.rule.extra = 1),
			],
			[
				"recommended aggregation",
				(l) => (l.checks[0].recommended.aggregation.extra = 1),
			],
		];
		for (const [where, mutate] of mutations) {
			const list = { pipeline: "P", checks: [richCheck()] } as Json;
			mutate(list);
			const response = await callPublishChecks(list, secret);
			expect(response.status, where).toBe(400);
		}
	});

	it("keeps unknown keys inside parameter bags as given", async () => {
		const { secret, owner, testCase } = await setup();
		const check = {
			name: "C",
			version: "1",
			scope: "item",
			value: { type: "number" },
			recommended: {
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 1, custom_note: { deep: [1, 2] } },
				},
			},
		};
		expect(
			(await callPublishChecks({ pipeline: "P", checks: [check] }, secret))
				.status
		).toBe(200);
		await mockAuth(owner.id);
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists[0].checks[0].recommended.rule.params.custom_note).toEqual({
			deep: [1, 2],
		});
	});

	it("replaces the previous list and changes no claim's settings", async () => {
		const { claim, integration, secret, owner, testCase } = await setup();
		await save(claim.id, integration.id);
		const before = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		const revisions = await revisionCount(claim.id);
		const result = await callPublishChecks(
			{ pipeline: "Another name", checks: [named(1)] },
			secret
		);
		expect(result.status).toBe(200);
		const after = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(after).toEqual(before);
		expect(await revisionCount(claim.id)).toBe(revisions);
		await mockAuth(owner.id);
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists).toHaveLength(1);
		expect(lists[0].pipeline).toBe("Another name");
		expect(lists[0].checks.map((c: Json) => c.name)).toEqual(["Check 1"]);
		expect(
			await prisma.pluginHealthCheckCatalogue.count({
				where: { integrationId: integration.id },
			})
		).toBe(1);
	});

	it("stores a recommendation that would not pass and warns, naming the check and the problem", async () => {
		const { secret, owner, testCase } = await setup();
		const result = await publish(secret, (list) => {
			list.checks[0].recommended.aggregation.params.use_verdict = false;
			list.checks[1].recommended.rule.params.marginal_values = 0.5;
			list.checks[2].recommended.reduction = { kind: "mean", params: {} };
		});
		expect(result.response.status).toBe(200);
		expect(result.body.checks).toBe(3);
		const warnings = result.body.warnings as {
			check: string;
			problem: string;
		}[];
		const byCheck = (name: string) =>
			warnings.filter((warning) => warning.check === name);
		expect(
			byCheck(ITEM_CHECK_NAME).some((w) => w.problem.includes("use_verdict"))
		).toBe(true);
		expect(
			byCheck("Edge Alignment Measure").some((w) =>
				w.problem.includes("marginal_values")
			)
		).toBe(true);
		expect(
			byCheck(SYSTEM_CHECK_NAME).some((w) => w.problem.includes("reduction"))
		).toBe(true);
		await mockAuth(owner.id);
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists[0].checks[0].recommended.aggregation.params.use_verdict).toBe(
			false
		);
	});

	it("gives no warnings for a list whose recommendations all pass, or that leaves blocks out", async () => {
		const { secret } = await setup();
		const clean = await publish(secret, () => undefined);
		expect(clean.body.warnings).toEqual([]);
		const partial = await publish(secret, (list) => {
			list.checks[0].recommended = { window: "PT1M" };
			list.checks[1].recommended = undefined;
		});
		expect(partial.body.warnings).toEqual([]);
	});

	it("refuses a list whose recommendation has the wrong shape, as a whole", async () => {
		const { secret, owner, testCase } = await setup();
		const result = await publish(secret, (list) => {
			list.checks[0].recommended.rule = { kind: "nonsense" };
		});
		expect(result.response.status).toBe(400);
		await mockAuth(owner.id);
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists[0].checks).toHaveLength(3);
	});

	it("refuses text with a NUL or an unpaired surrogate anywhere in a check list", async () => {
		const { secret } = await setup();
		for (const text of ["a\u0000b", "x\ud800y"]) {
			const places: [string, (list: Json) => void][] = [
				["pipeline", (l) => (l.pipeline = text)],
				["description", (l) => (l.checks[0].description = text)],
				[
					"scope_label",
					(l) => (l.checks[0].scope_label = { one: text, many: "m" }),
				],
				["param label", (l) => (l.checks[0].params[0].label = text)],
				["param default", (l) => (l.checks[0].params[0].default = text)],
				["unit", (l) => (l.checks[1].value.unit = text)],
				[
					"recommended params",
					(l) => (l.checks[0].recommended.rule.params = { note: text }),
				],
			];
			for (const [where, mutate] of places) {
				const list = buildHealthCheckList() as Json;
				mutate(list);
				const response = await callPublishChecks(list, secret);
				expect(response.status, `${where} ${JSON.stringify(text)}`).toBe(400);
			}
		}
		// Check name and version with a NUL.
		for (const field of ["name", "version", "scope"]) {
			const list = buildHealthCheckList() as Json;
			list.checks[0][field] = "a\u0000b";
			expect((await callPublishChecks(list, secret)).status).toBe(400);
		}
	});

	it("refuses an overlong description and a check with too many parameters", async () => {
		const { secret } = await setup();
		const long = await publish(secret, (list) => {
			list.checks[0].description = "d".repeat(2001);
		});
		expect(long.response.status).toBe(400);
		const many = await publish(secret, (list) => {
			list.checks[0].params = Array.from({ length: 51 }, (_, i) => ({
				key: `k${i}`,
				label: "K",
				type: "string",
			}));
		});
		expect(many.response.status).toBe(400);
		const dupKey = await publish(secret, (list) => {
			list.checks[0].params = [
				{ key: "k", label: "K", type: "string" },
				{ key: "k", label: "K2", type: "string" },
			];
		});
		expect(dupKey.response.status).toBe(400);
	});

	it("refuses an invalid body without touching the stored list", async () => {
		const { secret } = await setup();
		for (const body of [
			"",
			"{",
			"[]",
			"null",
			'{"pipeline":"P"}',
			'{"checks":[]}',
		]) {
			const response = await callPublishChecks(body, secret);
			expect(response.status).toBe(400);
		}
	});
});

describe("?live=true", () => {
	async function list(claimId: string, secret: string, query: string) {
		const { GET } = await importMachineRoute();
		const response = await GET(machineGet(claimId, secret, query), {
			params: Promise.resolve({ id: claimId }),
		});
		return { status: response.status, body: await response.json() };
	}
	const ago = (minutes: number) =>
		new Date(Date.now() - minutes * 60_000).toISOString();

	async function records() {
		const world = await setup();
		const { claim, owner } = world;
		const id = async (overrides: Json) =>
			(await appendRecord(owner.id, claim.id, "populationPass", overrides))
				.record_id;
		const live = await id({ timestamp: ago(3), valid_for: "PT1H" });
		const revoked = await id({ timestamp: ago(4), valid_for: "PT1H" });
		const expired = await id({ timestamp: ago(240), valid_for: "PT1H" });
		const forever = await id({ timestamp: ago(500), valid_for: "indefinite" });
		const reinstated = await id({ timestamp: ago(5), valid_for: "PT1H" });
		await callRevoke(claim.id, revoked);
		await callRevoke(claim.id, reinstated);
		await callReinstate(claim.id, reinstated);
		return { ...world, live, revoked, expired, forever, reinstated };
	}

	it("returns only records that are not revoked and have not expired, counting indefinite and reinstated ones", async () => {
		const world = await records();
		const all = await list(world.claim.id, world.secret, "");
		expect(all.body.evidence).toHaveLength(5);
		const live = await list(world.claim.id, world.secret, "?live=true");
		const ids = live.body.evidence.map((item: Json) => item.record.record_id);
		expect(new Set(ids)).toEqual(
			new Set([world.live, world.forever, world.reinstated])
		);
		expect(ids).not.toContain(world.revoked);
		expect(ids).not.toContain(world.expired);
		const explicit = await list(world.claim.id, world.secret, "?live=false");
		expect(explicit.body.evidence).toHaveLength(5);
	});

	it("pages through only live records, with no gaps or repeats and a null end", async () => {
		const world = await records();
		const seen: string[] = [];
		let before: number | null = null;
		for (let i = 0; i < 10; i++) {
			const query: string = `?live=true&limit=1${before === null ? "" : `&before=${before}`}`;
			const page = await list(world.claim.id, world.secret, query);
			expect(page.status).toBe(200);
			for (const item of page.body.evidence) {
				seen.push(item.record.record_id);
			}
			before = page.body.next_before;
			if (before === null) {
				break;
			}
		}
		expect(before).toBeNull();
		expect(seen).toHaveLength(3);
		expect(new Set(seen)).toEqual(
			new Set([world.live, world.forever, world.reinstated])
		);
	});

	it("pages with a limit larger than the live set and returns a null end", async () => {
		const world = await records();
		const page = await list(world.claim.id, world.secret, "?live=true&limit=3");
		expect(page.body.evidence).toHaveLength(3);
		expect(page.body.next_before).toBeNull();
		const two = await list(world.claim.id, world.secret, "?live=true&limit=2");
		expect(two.body.evidence).toHaveLength(2);
		expect(two.body.next_before).not.toBeNull();
	});

	it("refuses a live value that is not true or false", async () => {
		const world = await records();
		for (const value of ["TRUE", "1", "yes", ""]) {
			const response = await list(
				world.claim.id,
				world.secret,
				`?live=${value}`
			);
			expect(response.status, value).toBe(400);
		}
	});

	it("returns nothing for a claim with no live record, with a null end", async () => {
		const { claim, owner, secret } = await setup();
		await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: ago(600),
			valid_for: "PT1H",
		});
		const page = await list(claim.id, secret, "?live=true");
		expect(page.body).toEqual({ evidence: [], next_before: null });
	});

	it("counts a record as live until its expiry time passes", async () => {
		const { claim, owner, secret } = await setup();
		await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: ago(59),
			valid_for: "PT1H",
		});
		await appendRecord(owner.id, claim.id, "populationPass", {
			timestamp: ago(61),
			valid_for: "PT1H",
		});
		const page = await list(claim.id, secret, "?live=true");
		expect(page.body.evidence).toHaveLength(1);
	});
});

describe("the hygiene counts", () => {
	const ago = (minutes: number) =>
		new Date(Date.now() - minutes * 60_000).toISOString();

	it("matches hand counts, including a claim whose newest record is revoked", async () => {
		const { owner, testCase } = await setup();
		const claimFor = () =>
			createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});
		const check = (name: string) => ({
			check: { name, version: "1", scope: "item" },
		});
		const c1 = await claimFor();
		const c2 = await claimFor();
		const c3 = await claimFor();
		const c4 = await claimFor();
		const c5 = await claimFor();
		const c6 = await claimFor();
		const c7 = await claimFor();
		const gone = await claimFor();
		await appendRecord(owner.id, c1.id, "populationPass", {
			...check("X"),
			valid_for: "indefinite",
		});
		await appendRecord(owner.id, c2.id, "populationPass", {
			...check("X"),
			valid_for: "indefinite",
		});
		await appendRecord(owner.id, c3.id, "populationPass", {
			...check("Y"),
			valid_for: "PT1H",
		});
		await appendRecord(owner.id, c4.id, "populationPass", {
			...check("Z"),
			valid_for: "PT1H",
			timestamp: ago(30),
		});
		const newestC4 = await appendRecord(owner.id, c4.id, "populationPass", {
			...check("Z"),
			valid_for: "indefinite",
			timestamp: ago(10),
		});
		await callRevoke(c4.id, newestC4.record_id);
		await appendRecord(owner.id, c6.id, "populationPass", {
			...check("Y"),
			valid_for: "indefinite",
		});
		const onlyC7 = await appendRecord(owner.id, c7.id, "populationPass", {
			...check("W"),
			valid_for: "indefinite",
		});
		await callRevoke(c7.id, onlyC7.record_id);
		await appendRecord(owner.id, gone.id, "populationPass", {
			...check("V"),
			valid_for: "indefinite",
		});
		await prisma.assuranceElement.update({
			where: { id: gone.id },
			data: { deletedAt: new Date() },
		});
		expect(c5.id).toBeTruthy();

		await mockAuth(owner.id);
		const response = await callHygiene(testCase.id);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.claims_without_time_limit).toEqual({ count: 3, of: 5 });
		expect(body.checks_without_time_limit).toEqual({ count: 2, of: 3 });
		expect(body.settings_as_recommended).toEqual({ count: 0, of: 0 });
	});

	it("counts accepted settings that equal the recommendation, not suggested, retired or deleted ones", async () => {
		const { owner, testCase, integration } = await setup();
		const claimFor = () =>
			createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});
		const a = await claimFor();
		const b = await claimFor();
		const c = await claimFor();
		const d = await claimFor();
		const e = await claimFor();
		const f = await claimFor();
		await save(a.id, integration.id);
		await save(b.id, integration.id);
		await save(
			c.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT9M";
			})
		);
		await save(d.id, integration.id, itemSettings(), false);
		await save(e.id, integration.id);
		await callRetirement(e.id, { reason: "x" });
		await save(f.id, integration.id);
		await prisma.assuranceElement.update({
			where: { id: f.id },
			data: { deletedAt: new Date() },
		});
		const body = await (await callHygiene(testCase.id)).json();
		expect(body.settings_as_recommended).toEqual({ count: 2, of: 3 });
		expect(body.claims_without_time_limit).toEqual({ count: 0, of: 0 });
		expect(body.checks_without_time_limit).toEqual({ count: 0, of: 0 });
	});

	it("counts a claim by its latest result by timestamp, not by arrival order", async () => {
		const { owner, testCase } = await setup();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await appendRecord(owner.id, claim.id, "populationPass", {
			valid_for: "indefinite",
			timestamp: ago(60),
		});
		await appendRecord(owner.id, claim.id, "populationPass", {
			valid_for: "PT1H",
			timestamp: ago(120),
		});
		const body = await (await callHygiene(testCase.id)).json();
		expect(body.claims_without_time_limit).toEqual({ count: 1, of: 1 });
	});

	it("is not affected by another case's claims", async () => {
		const first = await setup();
		await appendRecord(first.owner.id, first.claim.id, "populationPass", {
			valid_for: "indefinite",
		});
		const second = await setup();
		const body = await (await callHygiene(second.testCase.id)).json();
		expect(body.claims_without_time_limit).toEqual({ count: 0, of: 0 });
	});
});
