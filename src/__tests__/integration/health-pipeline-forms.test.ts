import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	buildHealthCheckList,
	buildPipelineFormCheckList,
	ITEM_CHECK_NAME,
	PIPELINE_FORM_CHECK_NAME,
	WORST_OF_CHECK_NAME,
} from "../fixtures/health-checks";
import { OLDER_FORM_AGGREGATION } from "../fixtures/health-records";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	importMachineRoute,
	machineGet,
	machinePost,
	wireRecord,
} from "../utils/health-adversarial-kit";
import {
	callCaseChecks,
	callCriteriaGet,
	callCriteriaPut,
	callHygiene,
	callMachineClaimCriteria,
	callPublishChecks,
	saveBody,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";

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

/** A case whose pipeline has published `list` through the route. */
async function setup(list: unknown = buildPipelineFormCheckList()) {
	const context = await setupCriteriaCase({ publish: false });
	await mockAuth(context.owner.id, context.owner.username, context.owner.email);
	const published = await callPublishChecks(list, context.secret);
	if (published.status !== 200) {
		throw new Error(`publishing answered ${published.status}`);
	}
	return { ...context, published: await published.json() };
}

type Served = Record<string, any>;

async function offeredCheck(caseId: string, name: string): Promise<Served> {
	const lists = (await (await callCaseChecks(caseId)).json()) as Served[];
	const check = lists
		.flatMap((list) => list.checks as Served[])
		.find((entry) => entry.name === name);
	if (!check) {
		throw new Error(`check ${name} is not offered`);
	}
	return check;
}

/** A check's own recommendation as complete settings, the way the settings form builds them. */
function settingsFrom(check: Served): Record<string, unknown> {
	const params = Object.fromEntries(
		((check.params ?? []) as Served[])
			.filter((param) => param.default !== undefined)
			.map((param) => [param.key, param.default])
	);
	return {
		check: {
			name: check.name,
			version: check.version,
			scope: check.scope,
			...(Object.keys(params).length > 0 && { params }),
		},
		...check.recommended,
	};
}

async function put(
	claimId: string,
	integrationId: string,
	settings: Record<string, unknown>,
	extra: Record<string, unknown> = {}
) {
	const response = await callCriteriaPut(claimId, {
		...saveBody(integrationId, settings, true),
		...extra,
	});
	return { status: response.status, body: (await response.json()) as Served };
}

async function readView(claimId: string): Promise<Served> {
	return (await (await callCriteriaGet(claimId)).json()) as Served;
}

async function pipelineRead(claimId: string, secret: string): Promise<Served> {
	return (await (
		await callMachineClaimCriteria(claimId, secret)
	).json()) as Served;
}

/** The settings as a version of TEA that wrote the share's pass mark into `params` stored them. */
function olderForm(settings: Served): Served {
	const { rule: _rule, ...aggregation } = settings.aggregation;
	const { threshold: _unused, ...params } = settings.aggregation.params ?? {};
	return {
		...settings,
		aggregation: {
			...aggregation,
			params: {
				...params,
				threshold: settings.aggregation.rule.params.pass_values,
			},
		},
	};
}

describe("a check list in the pipeline's own form", () => {
	it("is accepted, warns only where a recommendation cannot be used as it stands, and stores plain settings as the list", async () => {
		const context = await setup();
		expect(context.published.checks).toBe(3);
		expect(context.published.warnings).toEqual([
			{
				check: PIPELINE_FORM_CHECK_NAME,
				problem: "recommended.aggregation.rule: is required",
			},
			{
				check: WORST_OF_CHECK_NAME,
				problem: "recommended.aggregation.kind: must be proportion",
			},
		]);
		const stored = await prisma.pluginHealthCheckCatalogue.findUniqueOrThrow({
			where: { integrationId: context.integration.id },
		});
		const gauge = (stored.checks as Served[]).find(
			(check) => check.name === PIPELINE_FORM_CHECK_NAME
		);
		expect(gauge?.value).toEqual({ type: "number" });
		expect(gauge?.params).toEqual([
			{
				key: "reference_gap",
				label: "Reference gap",
				type: "string",
				default: "mean_gap",
			},
			{ key: "max_dt", label: "Max dt", type: "duration", default: "PT12S" },
			{ key: "strict", label: "Strict", type: "boolean", default: false },
			{ key: "tolerance", label: "Tolerance", type: "number", default: 0.5 },
		]);
		expect(JSON.stringify(stored.checks)).not.toContain('"version":"0.0"');
	});

	it("refuses a plain setting with no default, naming the setting", async () => {
		const context = await setupCriteriaCase({ publish: false });
		const list = buildPipelineFormCheckList();
		const first = list.checks[0];
		const response = await callPublishChecks(
			{
				...list,
				checks: [{ ...first, params: { camera_line: null } }],
			},
			context.secret
		);
		expect(response.status).toBe(400);
		expect((await response.json()).fieldErrors).toHaveProperty(
			"checks.0.params.camera_line"
		);
	});

	it("lets a person accept a recommendation unchanged and serves it to the pipeline in the same form, labelled", async () => {
		const context = await setup();
		const { claim, integration, secret, testCase } = context;
		const check = await offeredCheck(testCase.id, ITEM_CHECK_NAME);
		const saved = await put(claim.id, integration.id, settingsFrom(check));
		expect(saved.status).toBe(200);
		expect(saved.body.criteria.source.kind).toBe("recommended");
		expect(saved.body.offered_version).toBe("0.3");

		const served = await pipelineRead(claim.id, secret);
		expect(served.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.05, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.8 },
				version: "a1",
			},
			version: "a1",
		});
		const hygiene = await (await callHygiene(testCase.id)).json();
		expect(hygiene.settings_as_recommended).toEqual({ count: 1, of: 1 });
	});

	it("keeps the plain settings a person saves, by their type", async () => {
		const context = await setup();
		const { claim, integration, secret, testCase } = context;
		const check = await offeredCheck(testCase.id, PIPELINE_FORM_CHECK_NAME);
		const settings = {
			...settingsFrom(check),
			check: {
				name: check.name,
				version: check.version,
				scope: "item",
				params: { max_dt: "PT20S", strict: true, tolerance: 2 },
			},
			rule: check.recommended.rule,
			aggregation: {
				kind: "proportion",
				params: { use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.75 },
				},
			},
		};
		expect((await put(claim.id, integration.id, settings)).status).toBe(200);
		const served = await pipelineRead(claim.id, secret);
		expect(served.check.params).toEqual({
			max_dt: "PT20S",
			strict: true,
			tolerance: 2,
		});
		const wrongType = await put(claim.id, integration.id, {
			...settings,
			check: { ...(settings.check as object), params: { max_dt: "soon" } },
		});
		expect(wrongType.status).toBe(400);
		expect(wrongType.body.fieldErrors).toHaveProperty(
			"settings.check.params.max_dt"
		);
	});
});

describe("an older recommendation", () => {
	const olderList = () => {
		const list = buildHealthCheckList();
		return {
			...list,
			checks: list.checks.map((check) => ({
				...check,
				recommended: check.recommended && {
					...check.recommended,
					aggregation: check.recommended.aggregation && {
						kind: "proportion",
						params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
					},
				},
			})),
		};
	};

	it("is offered in the current form, and counts as recommended when accepted unchanged", async () => {
		const context = await setup(olderList());
		const { claim, integration, testCase } = context;
		expect(context.published.warnings).toEqual([]);
		const check = await offeredCheck(testCase.id, ITEM_CHECK_NAME);
		expect(check.recommended.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.9 },
			},
		});
		const saved = await put(claim.id, integration.id, settingsFrom(check));
		expect(saved.body.criteria.source.kind).toBe("recommended");
		expect(saved.body.check_description.recommended.aggregation.rule).toEqual({
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.9 },
		});
	});
});

describe("settings stored before the combining steps changed form", () => {
	/** An accepted claim whose stored settings are rewritten as an older version stored them. */
	async function olderRow() {
		const context = await setup(buildHealthCheckList());
		const { claim, integration, testCase } = context;
		const check = await offeredCheck(testCase.id, ITEM_CHECK_NAME);
		const saved = await put(claim.id, integration.id, {
			...settingsFrom(check),
			reduction: {
				kind: "percentile",
				params: { p: 95, avail_floor: 0.8 },
				rule: check.recommended.reduction.rule,
			},
		});
		if (saved.status !== 200) {
			throw new Error(`saving answered ${saved.status}`);
		}
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		const settings = row.settings as Served;
		const { percentile, ...rest } = settings.reduction.params;
		await prisma.pluginHealthCriteria.update({
			where: { claimId: claim.id },
			data: {
				settings: olderForm({
					...settings,
					reduction: {
						...settings.reduction,
						params: { ...rest, p: percentile },
					},
				}),
			},
		});
		return { ...context, check };
	}

	it("serves an older row in the current form with its labels unchanged", async () => {
		const { claim, secret } = await olderRow();
		const view = await readView(claim.id);
		expect(view.criteria.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.95 },
				version: "a1",
			},
			version: "a1",
		});
		expect(view.criteria.reduction.params).toEqual({
			percentile: 95,
			avail_floor: 0.8,
		});
		expect(view.criteria.reduction.version).toBe("d1");
		const served = await pipelineRead(claim.id, secret);
		expect(served.aggregation).toEqual(view.criteria.aggregation);
		expect(served.reduction).toEqual(view.criteria.reduction);
	});

	it("moves no label and keeps the settings as recommended when it is saved again unchanged", async () => {
		const { claim, integration } = await olderRow();
		const before = await readView(claim.id);
		const { criteria } = before;
		const resend = {
			check: criteria.check,
			rule: { kind: criteria.rule.kind },
			reduction: {
				kind: "percentile",
				params: { p: 95, avail_floor: 0.8 },
				rule: stripLabel(criteria.reduction.rule),
			},
			aggregation: olderForm({
				aggregation: stripLabel(criteria.aggregation),
			}).aggregation,
			window: criteria.window,
			valid_for: criteria.valid_for,
		};
		const saved = await put(claim.id, integration.id, resend, {
			expected_revision: criteria.revision,
		});
		expect(saved.status).toBe(200);
		const after = saved.body.criteria;
		for (const block of ["rule", "reduction", "aggregation"]) {
			expect(after[block].version, block).toBe(criteria[block].version);
		}
		expect(after.aggregation).toEqual(criteria.aggregation);
		expect(after.reduction).toEqual(criteria.reduction);
		expect(after.source.aggregation).toBe(criteria.source.aggregation);
	});

	it("changes a label only when the content changes", async () => {
		const { claim, integration } = await olderRow();
		const { criteria } = await readView(claim.id);
		const resend = (passMark: number) => ({
			check: criteria.check,
			rule: { kind: criteria.rule.kind },
			reduction: {
				kind: "percentile",
				params: { percentile: 95, avail_floor: 0.8 },
				rule: stripLabel(criteria.reduction.rule),
			},
			aggregation: {
				kind: "proportion",
				params: { avail_floor: 0.8, use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: passMark },
				},
			},
			window: criteria.window,
			valid_for: criteria.valid_for,
		});
		const unchanged = await put(claim.id, integration.id, resend(0.95));
		expect(unchanged.body.criteria.aggregation.version).toBe("a1");
		expect(unchanged.body.criteria.reduction.version).toBe("d1");
		const edited = await put(claim.id, integration.id, resend(0.9));
		expect(edited.body.criteria.aggregation.version).toBe("a2");
		expect(edited.body.criteria.aggregation.rule.version).toBe("a2");
		expect(edited.body.criteria.reduction.version).toBe("d1");
	});
});

describe("a request in the older form", () => {
	it("is stored in the current form, with p stored as percentile", async () => {
		const context = await setup(buildHealthCheckList());
		const { claim, integration, secret, testCase } = context;
		const check = await offeredCheck(testCase.id, ITEM_CHECK_NAME);
		const saved = await put(claim.id, integration.id, {
			...settingsFrom(check),
			reduction: {
				kind: "percentile",
				params: { p: 90 },
				rule: check.recommended.reduction.rule,
			},
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.7, use_verdict: true },
			},
		});
		expect(saved.status).toBe(200);
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		const stored = row.settings as Served;
		expect(stored.aggregation).toEqual({
			kind: "proportion",
			params: { use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.7 },
			},
		});
		expect(stored.reduction.params).toEqual({ percentile: 90 });
		const served = await pipelineRead(claim.id, secret);
		expect(served.reduction.params).toEqual({ percentile: 90 });
	});

	it("names a pass mark out of range at the aggregation's rule", async () => {
		const context = await setup(buildHealthCheckList());
		const { claim, integration, testCase } = context;
		const check = await offeredCheck(testCase.id, ITEM_CHECK_NAME);
		const refused = await put(claim.id, integration.id, {
			...settingsFrom(check),
			aggregation: {
				kind: "proportion",
				params: { threshold: 1.5, use_verdict: true },
			},
		});
		expect(refused.status).toBe(400);
		expect(refused.body.fieldErrors).toHaveProperty(
			"settings.aggregation.rule.params.pass_values"
		);
	});
});

describe("a record", () => {
	async function post(claimId: string, secret: string, record: unknown) {
		const { POST } = await importMachineRoute();
		const response = await POST(machinePost(claimId, record, secret), {
			params: Promise.resolve({ id: claimId }),
		});
		return { response, body: (await response.json()) as Served };
	}

	async function accepted() {
		const context = await setup(buildHealthCheckList());
		const check = await offeredCheck(context.testCase.id, ITEM_CHECK_NAME);
		await put(context.claim.id, context.integration.id, settingsFrom(check));
		const item = await pipelineRead(context.claim.id, context.secret);
		return { ...context, item };
	}

	const echo = (claimId: string, item: Served, aggregation: unknown) =>
		wireRecord(claimId, "populationPass", {
			check: item.check,
			rule: item.rule,
			reduction: item.reduction,
			aggregation,
			window: item.window,
			valid_for: item.valid_for,
		});

	async function echoState(claimId: string, secret: string) {
		const { GET } = await importMachineRoute();
		const response = await GET(machineGet(claimId, secret), {
			params: Promise.resolve({ id: claimId }),
		});
		return (await response.json()).evidence[0].echo_state as string;
	}

	it("that echoes the served blocks, rule included, is stored as a match", async () => {
		const { claim, secret, item } = await accepted();
		const { response } = await post(
			claim.id,
			secret,
			echo(claim.id, item, item.aggregation)
		);
		expect(response.status).toBe(201);
		expect(await echoState(claim.id, secret)).toBe("match");
	});

	it("in the older form, with the pass mark in params, is still accepted and compared by its labels", async () => {
		const { claim, secret, item } = await accepted();
		const { response } = await post(
			claim.id,
			secret,
			echo(claim.id, item, {
				...OLDER_FORM_AGGREGATION,
				version: item.aggregation.version,
			})
		);
		expect(response.status).toBe(201);
		expect(await echoState(claim.id, secret)).toBe("match");
	});

	it("whose share has neither a rule nor a pass mark is refused, naming the field", async () => {
		const { claim, secret, item } = await accepted();
		const { response, body } = await post(
			claim.id,
			secret,
			echo(claim.id, item, {
				kind: "proportion",
				params: { use_verdict: true },
				version: item.aggregation.version,
			})
		);
		expect(response.status).toBe(400);
		expect(body.fieldErrors).toHaveProperty("aggregation.rule");
	});
});

describe("the version the pipeline offers", () => {
	it("is given with the settings, changes when the pipeline lists a newer version, and is absent once the check is no longer listed", async () => {
		const context = await setup(buildHealthCheckList());
		const { claim, integration, secret, testCase } = context;
		const check = await offeredCheck(testCase.id, ITEM_CHECK_NAME);
		await put(claim.id, integration.id, settingsFrom(check));
		expect((await readView(claim.id)).offered_version).toBe("0.3");

		const list = buildHealthCheckList();
		const republish = async (checks: typeof list.checks) =>
			callPublishChecks({ ...list, checks }, secret);
		await republish(
			list.checks.map((entry) =>
				entry.name === ITEM_CHECK_NAME ? { ...entry, version: "0.4" } : entry
			)
		);
		const newer = await readView(claim.id);
		expect(newer.check_offer).toBe("newer-version");
		expect(newer.offered_version).toBe("0.4");

		await republish(
			list.checks.filter((entry) => entry.name !== ITEM_CHECK_NAME)
		);
		const gone = await readView(claim.id);
		expect(gone.check_offer).toBe("not-offered");
		expect(gone.offered_version).toBeNull();
	});
});

/** A served block without its version label, as a form would send it back. */
function stripLabel<T extends Served>(block: T): Omit<T, "version"> {
	const { version: _label, ...rest } = block;
	if (rest.rule) {
		const { version: _ruleLabel, ...rule } = rest.rule;
		return { ...rest, rule } as Omit<T, "version">;
	}
	return rest as Omit<T, "version">;
}
