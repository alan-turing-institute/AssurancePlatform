import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	postResult,
	storedEcho,
} from "../utils/health-criteria-adversarial-kit";
import {
	callCaseChecks,
	callCriteriaGet,
	callCriteriaPut,
	callHygiene,
	callMachineCaseCriteria,
	callMachineClaimCriteria,
	callPublishChecks,
	callRetirement,
} from "../utils/health-criteria-kit";
import {
	FORMS_VERSION,
	insertOlderRow,
	newFormSettings,
	olderCheckEntry,
	olderRecommended,
	olderSettings,
	PLAIN_PARAMS_AS_STORED,
	pipelineRecommended,
	plainCheckEntry,
	saveFromServed,
	setupFormsCase,
	storeCheckListAsGiven,
} from "../utils/health-forms-kit";

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

type Json = Record<string, any>;

const json = async (response: Response) => (await response.json()) as Json;

async function publishPlain(
	secret: string,
	checks: Json[] = [plainCheckEntry()]
) {
	const response = await callPublishChecks(
		{ pipeline: "Plain pipeline", checks },
		secret
	);
	return { status: response.status, body: await json(response) };
}

async function put(
	claimId: string,
	integrationId: string,
	settings: Json,
	options: { accept?: boolean; expectedRevision?: number } = {}
) {
	const response = await callCriteriaPut(claimId, {
		integration_id: integrationId,
		settings,
		accept: options.accept ?? true,
		...(options.expectedRevision !== undefined && {
			expected_revision: options.expectedRevision,
		}),
	});
	return { status: response.status, body: await json(response) };
}

const labelsOf = (served: Json) => ({
	rule: served.rule.version,
	reduction: served.reduction?.version,
	aggregation: served.aggregation?.version,
});

/** A case whose pipeline lists the check in the older form, with an accepted claim stored in the older form. */
async function olderWorld() {
	const context = await setupFormsCase();
	await storeCheckListAsGiven(context.integration.id, [olderCheckEntry()]);
	await insertOlderRow({
		claimId: context.claim.id,
		integrationId: context.integration.id,
		userId: context.owner.id,
	});
	return context;
}

const SHARE_IN_PIPELINE_FORM = {
	kind: "proportion",
	params: { avail_floor: 0.8, use_verdict: true },
	rule: {
		kind: "threshold",
		direction: "maximize",
		params: { pass_values: 0.95 },
	},
};

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

describe("publishing a check list in the pipeline's own form", () => {
	it("accepts plain settings, scalar, version labels and a rule on the combining step, with no warning", async () => {
		const context = await setupFormsCase();
		const { status, body } = await publishPlain(context.secret);
		expect(status).toBe(200);
		expect(body).toEqual({ checks: 1, warnings: [] });
		const stored = await prisma.pluginHealthCheckCatalogue.findUniqueOrThrow({
			where: { integrationId: context.integration.id },
		});
		const [check] = stored.checks as Json[];
		expect(check?.params).toEqual(PLAIN_PARAMS_AS_STORED);
		expect(check?.value).toEqual({ type: "number", unit: "mm" });
		expect(JSON.stringify(check?.recommended)).not.toContain("version");
		expect(check?.recommended.aggregation.rule.params).toEqual({
			pass_values: 0.95,
		});
	});

	it("serves the list to the case with the settings as a list, the value as number and no labels", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const lists = (await (
			await callCaseChecks(context.testCase.id)
		).json()) as Json[];
		const [check] = lists[0]?.checks ?? [];
		expect(check.params).toEqual(PLAIN_PARAMS_AS_STORED);
		expect(check.value).toEqual({ type: "number", unit: "mm" });
		expect(check.recommended.aggregation).toEqual(SHARE_IN_PIPELINE_FORM);
		expect(JSON.stringify(check.recommended)).not.toContain('"version"');
	});

	it("keeps the extremes of a plain number through storage", async () => {
		const context = await setupFormsCase();
		const { status } = await publishPlain(context.secret, [
			plainCheckEntry({
				params: { big: 1e300, tiny: 5e-324, zero: 0, negative: -2.5 },
			}),
		]);
		expect(status).toBe(200);
		const lists = (await (
			await callCaseChecks(context.testCase.id)
		).json()) as Json[];
		const [check] = lists[0]?.checks ?? [];
		expect(check.params.map((param: Json) => param.default)).toEqual([
			1e300, 5e-324, 0, -2.5,
		]);
	});

	it("warns only where a recommendation cannot be used as it stands, and still stores the list", async () => {
		const context = await setupFormsCase();
		const recommendedWith = (aggregation: Json) => ({
			...pipelineRecommended(),
			aggregation,
		});
		const { status, body } = await publishPlain(context.secret, [
			plainCheckEntry({ name: "Fine" }),
			plainCheckEntry({
				name: "Older share",
				recommended: olderRecommended(),
			}),
			plainCheckEntry({
				name: "No rule",
				recommended: recommendedWith({
					kind: "proportion",
					params: { avail_floor: 0.8, use_verdict: true },
					version: "a1",
				}),
			}),
			plainCheckEntry({
				name: "Worst on verdicts",
				recommended: recommendedWith({
					kind: "worst-of",
					params: { use_verdict: true },
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 5 },
					},
				}),
			}),
			plainCheckEntry({
				name: "Marginal share",
				recommended: recommendedWith({
					kind: "proportion",
					params: { use_verdict: true },
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 0.9, marginal_values: 0.8 },
					},
				}),
			}),
			plainCheckEntry({
				name: "Lowest share",
				recommended: recommendedWith({
					kind: "proportion",
					params: { use_verdict: true },
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 0.1 },
					},
				}),
			}),
		]);
		expect(status).toBe(200);
		expect(body.checks).toBe(6);
		const problems = (name: string) =>
			(body.warnings as { check: string; problem: string }[])
				.filter((warning) => warning.check === name)
				.map((warning) => warning.problem);
		expect(problems("Fine")).toEqual([]);
		expect(problems("Older share")).toEqual([]);
		expect(problems("No rule")).toEqual([
			"recommended.aggregation.rule: is required",
		]);
		expect(problems("Worst on verdicts")).toEqual([
			"recommended.aggregation.kind: must be proportion",
		]);
		expect(problems("Marginal share")).toEqual([
			"recommended.aggregation.rule.params.marginal_values: is not available in evidence settings",
		]);
		expect(problems("Lowest share")).toEqual([
			"recommended.aggregation.rule.direction: must be maximize",
		]);
		expect(await prisma.pluginHealthCheckCatalogue.count()).toBe(1);
	});

	it("refuses a null setting, naming the setting, and keeps the list it had", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const refused = await publishPlain(context.secret, [
			plainCheckEntry({ params: { max_gap: null } }),
		]);
		expect(refused.status).toBe(400);
		expect(JSON.stringify(refused.body)).toContain("max_gap");
		const stored = await prisma.pluginHealthCheckCatalogue.findUniqueOrThrow({
			where: { integrationId: context.integration.id },
		});
		expect((stored.checks as Json[])[0]?.params).toEqual(
			PLAIN_PARAMS_AS_STORED
		);
	});

	it("refuses a recommended version label that is not text, naming it", async () => {
		const context = await setupFormsCase();
		const recommended = pipelineRecommended();
		recommended.aggregation.rule.version = 7;
		const refused = await publishPlain(context.secret, [
			plainCheckEntry({ recommended }),
		]);
		expect(refused.status).toBe(400);
		expect(JSON.stringify(refused.body)).toContain("aggregation");
	});
});

// ---------------------------------------------------------------------------
// A list stored before the change
// ---------------------------------------------------------------------------

describe("a check list stored in the older form", () => {
	it("is served with the share as a rule and the percentile named percentile", async () => {
		const context = await setupFormsCase();
		await storeCheckListAsGiven(context.integration.id, [olderCheckEntry()]);
		const lists = (await (
			await callCaseChecks(context.testCase.id)
		).json()) as Json[];
		const [check] = lists[0]?.checks ?? [];
		expect(check.recommended.aggregation).toEqual(SHARE_IN_PIPELINE_FORM);
		expect(check.recommended.reduction.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
		expect(check.recommended.rule).toEqual(olderRecommended().rule);
	});

	it("is served without error when its checks are not a list", async () => {
		const context = await setupFormsCase();
		await prisma.pluginHealthCheckCatalogue.create({
			data: {
				integrationId: context.integration.id,
				pipeline: "Odd",
				checks: {},
				publishedAt: new Date(),
			},
		});
		const response = await callCaseChecks(context.testCase.id);
		expect(response.status).toBe(200);
		expect(((await response.json()) as Json[])[0]?.checks).toEqual([]);
	});

	it("counts as recommended, in the case's hygiene figure, when its recommendation is accepted unchanged", async () => {
		const context = await setupFormsCase();
		await storeCheckListAsGiven(context.integration.id, [olderCheckEntry()]);
		const lists = (await (
			await callCaseChecks(context.testCase.id)
		).json()) as Json[];
		const [check] = lists[0]?.checks ?? [];
		const settings = {
			check: {
				name: check.name,
				version: check.version,
				scope: check.scope,
				params: {
					max_gap: "PT12S",
					sample_count: 5,
					strict: false,
					mode: "fast",
				},
			},
			...check.recommended,
		};
		const saved = await put(context.claim.id, context.integration.id, settings);
		expect(saved.status).toBe(200);
		expect(saved.body.criteria.source).toMatchObject({
			kind: "recommended",
			aggregation: "recommended",
			reduction: "recommended",
		});
		const hygiene = await json(await callHygiene(context.testCase.id));
		expect(hygiene.settings_as_recommended).toEqual({ count: 1, of: 1 });
	});

	it("counts as recommended when the older recommendation is sent back in the older form", async () => {
		const context = await setupFormsCase();
		await storeCheckListAsGiven(context.integration.id, [olderCheckEntry()]);
		const saved = await put(
			context.claim.id,
			context.integration.id,
			olderSettings()
		);
		expect(saved.status).toBe(200);
		expect(saved.body.criteria.source.kind).toBe("recommended");
		expect(saved.body.criteria.aggregation).toMatchObject(
			SHARE_IN_PIPELINE_FORM
		);
		expect(saved.body.criteria.aggregation.params).not.toHaveProperty(
			"threshold"
		);
	});
});

// ---------------------------------------------------------------------------
// A settings row stored before the change
// ---------------------------------------------------------------------------

describe("a settings row stored in the older form", () => {
	it("is served to the pipeline in the pipeline's form, for the case and for the claim, with the labels it had", async () => {
		const context = await olderWorld();
		const forCase = await json(
			await callMachineCaseCriteria(context.testCase.id, context.secret)
		);
		const forClaim = await json(
			await callMachineClaimCriteria(context.claim.id, context.secret)
		);
		for (const item of [forCase.criteria[0], forClaim] as Json[]) {
			expect(item.aggregation).toEqual({
				...SHARE_IN_PIPELINE_FORM,
				rule: { ...SHARE_IN_PIPELINE_FORM.rule, version: "a3" },
				version: "a3",
			});
			expect(item.reduction.params).toEqual({
				percentile: 90,
				avail_floor: 0.8,
			});
			expect(labelsOf(item)).toEqual({
				rule: "r4",
				reduction: "d2",
				aggregation: "a3",
			});
			expect(item.reduction.rule.version).toBe("d2");
			expect(item.source.kind).toBe("recommended");
		}
	});

	it("is served to the settings view in the same form, with the version the pipeline offers", async () => {
		const context = await olderWorld();
		const view = await json(await callCriteriaGet(context.claim.id));
		expect(view.criteria.aggregation.rule.version).toBe("a3");
		expect(view.criteria.aggregation.params).not.toHaveProperty("threshold");
		expect(view.criteria.reduction.params).not.toHaveProperty("p");
		expect(view.criteria.reduction.params.percentile).toBe(90);
		expect(view.check_offer).toBe("current");
		expect(view.offered_version).toBe(FORMS_VERSION);
		expect(view.check_description.recommended.aggregation).toEqual(
			SHARE_IN_PIPELINE_FORM
		);
		expect(view.check_description.recommended.reduction.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
	});

	it("is served in the new form when it is only a suggestion", async () => {
		const context = await setupFormsCase();
		await storeCheckListAsGiven(context.integration.id, [olderCheckEntry()]);
		await insertOlderRow({
			claimId: context.claim.id,
			integrationId: context.integration.id,
			userId: context.owner.id,
			state: "SUGGESTED",
		});
		const view = await json(await callCriteriaGet(context.claim.id));
		expect(view.criteria.state).toBe("suggested");
		expect(view.criteria.aggregation.rule.params).toEqual({
			pass_values: 0.95,
		});
		expect(view.criteria.aggregation.rule.version).toBe("a3");
	});

	it("keeps every label and 'as recommended' when saved again unchanged, twice in a row", async () => {
		const context = await olderWorld();
		const view = await json(await callCriteriaGet(context.claim.id));
		let revision = view.criteria.revision as number;
		for (const round of [1, 2]) {
			const saved = await put(
				context.claim.id,
				context.integration.id,
				saveFromServed(view.criteria),
				{ expectedRevision: revision }
			);
			expect(saved.status, `round ${round}`).toBe(200);
			revision = saved.body.criteria.revision;
			expect(labelsOf(saved.body.criteria)).toEqual({
				rule: "r4",
				reduction: "d2",
				aggregation: "a3",
			});
			expect(saved.body.criteria.source).toMatchObject({
				kind: "recommended",
				rule: "recommended",
				reduction: "recommended",
				aggregation: "recommended",
				timing: "recommended",
			});
		}
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect([
			row.ruleVersion,
			row.reductionVersion,
			row.aggregationVersion,
		]).toEqual([4, 2, 3]);
		const stored = row.settings as Json;
		expect(stored.aggregation).toEqual(SHARE_IN_PIPELINE_FORM);
		expect(stored.reduction.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
		expect(row.revision).toBe(7);
		const hygiene = await json(await callHygiene(context.testCase.id));
		expect(hygiene.settings_as_recommended).toEqual({ count: 1, of: 1 });
	});

	it("keeps every label and 'as recommended' when saved again in the older form", async () => {
		const context = await olderWorld();
		const saved = await put(
			context.claim.id,
			context.integration.id,
			olderSettings()
		);
		expect(saved.status).toBe(200);
		expect(labelsOf(saved.body.criteria)).toEqual({
			rule: "r4",
			reduction: "d2",
			aggregation: "a3",
		});
		expect(saved.body.criteria.source.kind).toBe("recommended");
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect((row.settings as Json).aggregation).toEqual(SHARE_IN_PIPELINE_FORM);
		expect((row.settings as Json).reduction.params).not.toHaveProperty("p");
	});

	it("moves only the aggregation's label, and marks only it as edited, when the pass mark changes", async () => {
		const context = await olderWorld();
		const view = await json(await callCriteriaGet(context.claim.id));
		const settings = saveFromServed(view.criteria);
		settings.aggregation.rule.params.pass_values = 0.9;
		const saved = await put(context.claim.id, context.integration.id, settings);
		expect(saved.status).toBe(200);
		expect(labelsOf(saved.body.criteria)).toEqual({
			rule: "r4",
			reduction: "d2",
			aggregation: "a4",
		});
		expect(saved.body.criteria.source).toMatchObject({
			kind: "edited",
			aggregation: "edited",
			reduction: "recommended",
			rule: "recommended",
		});
	});

	it("moves only the reduction's label when only the percentile changes, sent as p", async () => {
		const context = await olderWorld();
		const settings = olderSettings();
		settings.reduction.params.p = 75;
		const saved = await put(context.claim.id, context.integration.id, settings);
		expect(saved.status).toBe(200);
		expect(labelsOf(saved.body.criteria)).toEqual({
			rule: "r4",
			reduction: "d3",
			aggregation: "a3",
		});
		expect(saved.body.criteria.reduction.params.percentile).toBe(75);
	});

	it("keeps its source and labels when saved unchanged after the check has left the list", async () => {
		const context = await olderWorld();
		await storeCheckListAsGiven(context.integration.id, [
			olderCheckEntry({ name: "A Different Check" }),
		]);
		const view = await json(await callCriteriaGet(context.claim.id));
		expect(view.check_offer).toBe("not-offered");
		expect(view.offered_version).toBeNull();
		const saved = await put(
			context.claim.id,
			context.integration.id,
			saveFromServed(view.criteria),
			{ expectedRevision: view.criteria.revision }
		);
		expect(saved.status).toBe(200);
		expect(labelsOf(saved.body.criteria)).toEqual({
			rule: "r4",
			reduction: "d2",
			aggregation: "a3",
		});
		expect(saved.body.criteria.source).toMatchObject({
			kind: "recommended",
			aggregation: "recommended",
			reduction: "recommended",
		});
		// The check's stored description is read in the new form whichever form it was kept in.
		expect(saved.body.check_description.recommended.aggregation).toEqual(
			SHARE_IN_PIPELINE_FORM
		);
		expect(saved.body.check_description.recommended.reduction.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
	});

	it("keeps the other blocks as recommended when only the timing changes after the check has left the list", async () => {
		const context = await olderWorld();
		await storeCheckListAsGiven(context.integration.id, [
			olderCheckEntry({ name: "A Different Check" }),
		]);
		const view = await json(await callCriteriaGet(context.claim.id));
		const settings = saveFromServed(view.criteria);
		settings.window = "PT7M";
		const saved = await put(context.claim.id, context.integration.id, settings);
		expect(saved.status).toBe(200);
		expect(saved.body.criteria.source).toMatchObject({
			kind: "edited",
			timing: "edited",
			aggregation: "recommended",
			reduction: "recommended",
			rule: "recommended",
		});
		expect(labelsOf(saved.body.criteria)).toEqual({
			rule: "r4",
			reduction: "d2",
			aggregation: "a3",
		});
	});

	it("is written to the history in the new form, with its labels, when it is retired", async () => {
		const context = await olderWorld();
		const retired = await callRetirement(context.claim.id, {
			reason: "Replaced by a newer check",
		});
		expect(retired.status).toBe(200);
		const history = await prisma.pluginHealthCriteriaRevision.findFirstOrThrow({
			where: { claimId: context.claim.id },
			orderBy: { revision: "desc" },
		});
		const declaration = history.declaration as Json;
		expect(declaration.aggregation).toEqual({
			...SHARE_IN_PIPELINE_FORM,
			rule: { ...SHARE_IN_PIPELINE_FORM.rule, version: "a3" },
			version: "a3",
		});
		expect(declaration.reduction.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
		expect(declaration.reduction.version).toBe("d2");
		const body = await json(await callCriteriaGet(context.claim.id));
		expect(body.offered_version).toBeNull();
		expect(body.check_offer).toBeNull();
	});

	it("continues from the labels it had when the settings are started again after being retired", async () => {
		const context = await olderWorld();
		await callRetirement(context.claim.id, { reason: "Paused" });
		const restarted = await put(
			context.claim.id,
			context.integration.id,
			olderSettings()
		);
		expect(restarted.status).toBe(200);
		expect(restarted.body.criteria.state).toBe("accepted");
		expect(labelsOf(restarted.body.criteria)).toEqual({
			rule: "r4",
			reduction: "d2",
			aggregation: "a3",
		});
		expect(restarted.body.criteria.source.kind).toBe("recommended");
		expect(restarted.body.criteria.revision).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// The share in the pipeline's form, chosen, saved and served
// ---------------------------------------------------------------------------

describe("the share chosen and accepted in the pipeline's form", () => {
	it("is stored, served with the combining label on the step and on its rule, and read back by the pipeline", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const saved = await put(
			context.claim.id,
			context.integration.id,
			newFormSettings()
		);
		expect(saved.status).toBe(200);
		expect(saved.body.criteria.aggregation).toEqual({
			...SHARE_IN_PIPELINE_FORM,
			rule: { ...SHARE_IN_PIPELINE_FORM.rule, version: "a1" },
			version: "a1",
		});
		expect(saved.body.criteria.source.kind).toBe("recommended");
		const read = await json(
			await callMachineClaimCriteria(context.claim.id, context.secret)
		);
		expect(read.aggregation).toEqual(saved.body.criteria.aggregation);
		expect(read.check.params).toEqual({
			max_gap: "PT12S",
			sample_count: 5,
			strict: false,
			mode: "fast",
		});
	});

	it("moves the combining label when the pass mark changes and not when it is sent again", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		await put(context.claim.id, context.integration.id, newFormSettings());
		const same = await put(
			context.claim.id,
			context.integration.id,
			newFormSettings()
		);
		expect(same.body.criteria.aggregation.version).toBe("a1");
		const changed = newFormSettings();
		changed.aggregation.rule.params.pass_values = 0.9;
		const moved = await put(context.claim.id, context.integration.id, changed);
		expect(moved.body.criteria.aggregation.version).toBe("a2");
		expect(moved.body.criteria.aggregation.rule.version).toBe("a2");
		expect(moved.body.criteria.reduction.version).toBe("d1");
	});

	it.each([
		[
			"a pass mark above 1",
			(s: Json) => {
				s.aggregation.rule.params.pass_values = 1.5;
			},
			"aggregation.rule.params.pass_values",
		],
		[
			"a pass mark below 0",
			(s: Json) => {
				s.aggregation.rule.params.pass_values = -0.2;
			},
			"aggregation.rule.params.pass_values",
		],
		[
			"a missing pass mark",
			(s: Json) => {
				s.aggregation.rule.params = {};
			},
			"aggregation.rule.params.pass_values",
		],
		[
			"no rule",
			(s: Json) => {
				s.aggregation.rule = undefined;
			},
			"aggregation.rule",
		],
		[
			"a marginal mark",
			(s: Json) => {
				s.aggregation.rule.params.marginal_values = 0.8;
			},
			"aggregation.rule.params.marginal_values",
		],
		[
			"a minimum rule",
			(s: Json) => {
				s.aggregation.rule.direction = "minimize";
			},
			"aggregation.rule.direction",
		],
		[
			"a pass mark beside the rule",
			(s: Json) => {
				s.aggregation.params.threshold = 0.9;
			},
			"aggregation.params.threshold",
		],
		[
			"a worst-of step",
			(s: Json) => {
				s.aggregation.kind = "worst-of";
			},
			"aggregation.kind",
		],
		[
			"a percentile out of range",
			(s: Json) => {
				s.reduction.params.percentile = 120;
			},
			"reduction.params.percentile",
		],
	])("refuses %s and places the error on its field", async (_name, mutate, field) => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const settings = newFormSettings();
		mutate(settings);
		const refused = await put(
			context.claim.id,
			context.integration.id,
			settings
		);
		expect(refused.status).toBe(400);
		expect(JSON.stringify(refused.body)).toContain(`settings.${field}`);
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
	});

	it("refuses an out-of-range pass mark sent in the older form on the new field", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const settings = olderSettings();
		settings.aggregation.params.threshold = 1.5;
		const refused = await put(
			context.claim.id,
			context.integration.id,
			settings
		);
		expect(refused.status).toBe(400);
		expect(JSON.stringify(refused.body)).toContain(
			"settings.aggregation.rule.params.pass_values"
		);
	});
});

// ---------------------------------------------------------------------------
// offered_version
// ---------------------------------------------------------------------------

describe("the version the pipeline offers", () => {
	it("is on the settings view while the pipeline lists the check, and follows a newer version", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		await put(context.claim.id, context.integration.id, newFormSettings());
		const current = await json(await callCriteriaGet(context.claim.id));
		expect(current.check_offer).toBe("current");
		expect(current.offered_version).toBe(FORMS_VERSION);

		await publishPlain(context.secret, [plainCheckEntry({ version: "2.2" })]);
		const newer = await json(await callCriteriaGet(context.claim.id));
		expect(newer.check_offer).toBe("newer-version");
		expect(newer.offered_version).toBe("2.2");

		await publishPlain(context.secret, [plainCheckEntry({ name: "Other" })]);
		const gone = await json(await callCriteriaGet(context.claim.id));
		expect(gone.check_offer).toBe("not-offered");
		expect(gone.offered_version).toBeNull();
	});

	it("is on the view returned by a save", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const saved = await put(
			context.claim.id,
			context.integration.id,
			newFormSettings(),
			{ accept: false }
		);
		expect(saved.body.offered_version).toBe(FORMS_VERSION);
	});

	it("is null for a claim with no settings", async () => {
		const context = await setupFormsCase();
		await publishPlain(context.secret);
		const view = await json(await callCriteriaGet(context.claim.id));
		expect(view.criteria).toBeNull();
		expect(view.offered_version).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

describe("a record against settings stored in the older form", () => {
	async function served(context: Awaited<ReturnType<typeof olderWorld>>) {
		return await json(
			await callMachineClaimCriteria(context.claim.id, context.secret)
		);
	}

	it("is stored as a match when it echoes the blocks the pipeline read", async () => {
		const context = await olderWorld();
		const item = await served(context);
		const result = await postResult(context.claim.id, context.secret, item);
		expect(result.status).toBe(201);
		const echo = await storedEcho(result.recordId);
		expect(echo?.echoState).toBe("MATCH");
		const stored = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { recordId: result.recordId },
		});
		const record = stored.record as Json;
		expect(record.aggregation.rule.params.pass_values).toBe(0.95);
		expect(record.aggregation.rule.version).toBe("a3");
		expect(record.reduction.params.percentile).toBe(90);
	});

	it("is still accepted as a match in the older form of the record", async () => {
		const context = await olderWorld();
		const item = await served(context);
		const result = await postResult(context.claim.id, context.secret, item, {
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
				version: "a3",
			},
			reduction: {
				kind: "percentile",
				params: { p: 90, avail_floor: 0.8 },
				version: "d2",
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.8 },
					version: "d2",
				},
			},
		});
		expect(result.status).toBe(201);
		expect((await storedEcho(result.recordId))?.echoState).toBe("MATCH");
	});

	it("is a mismatch when it echoes another label for the combining step", async () => {
		const context = await olderWorld();
		const item = await served(context);
		const result = await postResult(context.claim.id, context.secret, item, {
			aggregation: {
				...item.aggregation,
				version: "a2",
				rule: { ...item.aggregation.rule, version: "a2" },
			},
		});
		expect(result.status).toBe(201);
		const echo = await storedEcho(result.recordId);
		expect(echo?.echoState).toBe("MISMATCH");
		expect(JSON.stringify(echo?.echoDifferences)).toContain(
			"aggregation.version"
		);
	});

	it("is refused when its share has neither a rule nor a pass mark, naming the rule", async () => {
		const context = await olderWorld();
		const item = await served(context);
		const result = await postResult(context.claim.id, context.secret, item, {
			aggregation: {
				kind: "proportion",
				params: { avail_floor: 0.8, use_verdict: true },
				version: "a3",
			},
		});
		expect(result.status).toBe(400);
		expect(JSON.stringify(result.body)).toContain("aggregation");
		expect(JSON.stringify(result.body)).toContain("rule");
	});

	it("is refused when the rule on its share has no version", async () => {
		const context = await olderWorld();
		const item = await served(context);
		const { version: _dropped, ...rule } = item.aggregation.rule;
		const result = await postResult(context.claim.id, context.secret, item, {
			aggregation: { ...item.aggregation, rule },
		});
		expect(result.status).toBe(400);
	});

	it("shows in the claim's latest result as a match", async () => {
		const context = await olderWorld();
		const item = await served(context);
		await postResult(context.claim.id, context.secret, item);
		const view = await json(await callCriteriaGet(context.claim.id));
		expect(view.latest_result.differences).toEqual([]);
	});
});
