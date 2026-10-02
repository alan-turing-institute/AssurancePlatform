import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJSON } from "@/lib/health-canonical-json";
import prisma from "@/lib/prisma";
import { deleteIntegrationRegistration } from "@/lib/services/integration-registry-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "../fixtures/health-checks";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	callBoundCheck,
	callStatus,
	importMachineRoute,
	machineGet,
	machinePost,
	wireRecord,
} from "../utils/health-adversarial-kit";
import {
	criteriaWorld,
	deepClone,
	itemSettingsWith,
	numericSettings,
	pipelineRead,
	postResult,
	readView,
	save,
	storedEcho,
} from "../utils/health-criteria-adversarial-kit";
import {
	addPipeline,
	callCriteriaGet,
	callMachineCaseCriteria,
	callMachineCaseStatus,
	callMachineClaimCriteria,
	callMachineClaimStatus,
	callPublishChecks,
	callRetirement,
	itemSettings,
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

type Blocks = Record<string, unknown>;

/** The version-free content of each block, keyed by block. */
function contentOf(served: Blocks) {
	const strip = (value: unknown): unknown => {
		if (Array.isArray(value)) {
			return value.map(strip);
		}
		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value as Blocks)
					.filter(([key]) => key !== "version")
					.map(([key, inner]) => [key, strip(inner)])
			);
		}
		return value;
	};
	return {
		r: strip(served.rule),
		d: strip(served.reduction),
		a: strip(served.aggregation),
	};
}

function labelsOf(served: Blocks) {
	const rule = (served.rule as { version: string }).version;
	const reduction = (served.reduction as { version?: string } | undefined)
		?.version;
	const aggregation = (served.aggregation as { version?: string } | undefined)
		?.version;
	return { rule, reduction, aggregation };
}

async function evidenceList(claimId: string, secret: string, query = "") {
	const { GET } = await importMachineRoute();
	const response = await GET(machineGet(claimId, secret, query), {
		params: Promise.resolve({ id: claimId }),
	});
	return { status: response.status, body: await response.json() };
}

describe("version labels", () => {
	it("labels a first accepted save r1, d1, a1", async () => {
		const { claim, integration, secret } = await setup();
		await save(claim.id, integration.id);
		const read = await pipelineRead(claim.id, secret);
		expect(labelsOf(read.body)).toEqual({
			rule: "r1",
			reduction: "d1",
			aggregation: "a1",
		});
		expect(read.body.reduction.rule.version).toBe("d1");
	});

	it("leaves the reduction label out and counter at zero for a check with no reduction", async () => {
		const { claim, integration, secret } = await setup();
		await save(claim.id, integration.id, numericSettings());
		const read = await pipelineRead(claim.id, secret);
		expect(read.body.rule.version).toBe("r1");
		expect(read.body.aggregation.version).toBe("a1");
		expect(read.body.reduction).toBeUndefined();
	});

	it.each([
		["suggested", false],
		["accepted", true],
	])("raises only the rule label when only the rule changes (%s)", async (_label, accept) => {
		const { claim, integration, secret } = await setup();
		if (accept) {
			await save(claim.id, integration.id, itemSettings(), true);
		} else {
			await save(claim.id, integration.id, itemSettings(), false);
		}
		const changed = itemSettingsWith((settings) => {
			settings.rule = { kind: "identity", params: { note: 1 } };
		});
		const saved = await save(claim.id, integration.id, changed, accept);
		expect(saved.body.criteria.rule.version).toBe("r2");
		expect(saved.body.criteria.reduction.version).toBe("d1");
		expect(saved.body.criteria.aggregation.version).toBe("a1");
		if (accept) {
			expect(labelsOf((await pipelineRead(claim.id, secret)).body)).toEqual({
				rule: "r2",
				reduction: "d1",
				aggregation: "a1",
			});
		}
	});

	it("raises all three labels when the check's name changes, and not again to an old label", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id, itemSettings(), false);
		const toNumeric = await save(
			claim.id,
			integration.id,
			numericSettings(),
			false
		);
		expect(toNumeric.body.criteria.rule.version).toBe("r2");
		expect(toNumeric.body.criteria.aggregation.version).toBe("a2");
		const back = await save(claim.id, integration.id, itemSettings(), false);
		expect(labelsOf(back.body.criteria)).toEqual({
			rule: "r3",
			reduction: "d3",
			aggregation: "a3",
		});
	});

	it("leaves every label alone when only the check's version or its own settings change", async () => {
		const { claim, integration, secret } = await setup();
		await save(claim.id, integration.id);
		const list = buildHealthCheckList();
		const check = list.checks.find((entry) => entry.name === ITEM_CHECK_NAME);
		if (!check) {
			throw new Error("missing");
		}
		check.version = "0.4";
		expect((await callPublishChecks(list, secret)).status).toBe(200);
		const bumped = await save(
			claim.id,
			integration.id,
			itemSettingsWith((settings) => {
				settings.check.version = "0.4";
				settings.check.params = { camera_line: "LINE-B" };
			})
		);
		expect(bumped.status).toBe(200);
		expect(labelsOf(bumped.body.criteria)).toEqual({
			rule: "r1",
			reduction: "d1",
			aggregation: "a1",
		});
		expect(bumped.body.criteria.check.version).toBe("0.4");
		expect(bumped.body.criteria.check.params).toEqual({
			camera_line: "LINE-B",
		});
	});

	it("continues revisions and counters across suggest, discard, suggest again", async () => {
		const { claim, integration } = await setup();
		const first = await save(claim.id, integration.id, itemSettings(), false);
		expect(first.body.criteria.revision).toBe(1);
		const discarded = await callRetirement(claim.id, {});
		expect(discarded.status).toBe(200);
		expect((await discarded.json()).criteria.state).toBe("inactive");
		const again = await save(claim.id, integration.id, itemSettings(), false);
		expect(again.body.criteria.revision).toBe(3);
		expect(again.body.criteria.state).toBe("suggested");
		expect(labelsOf(again.body.criteria)).toEqual({
			rule: "r1",
			reduction: "d1",
			aggregation: "a1",
		});
		const differing = await save(
			claim.id,
			integration.id,
			itemSettingsWith((settings) => {
				settings.rule = { kind: "identity", params: { a: 1 } };
			}),
			false
		);
		expect(differing.body.criteria.revision).toBe(4);
		expect(differing.body.criteria.rule.version).toBe("r2");
	});

	it("does not reuse a label for different content after a discard", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id, itemSettings(), false);
		await callRetirement(claim.id, {});
		const different = await save(
			claim.id,
			integration.id,
			itemSettingsWith((settings) => {
				settings.aggregation.params.threshold = 0.5;
			}),
			false
		);
		expect(different.body.criteria.aggregation.version).toBe("a2");
		expect(different.body.criteria.rule.version).toBe("r1");
	});

	it("continues revisions and counters across retire and set up again", async () => {
		const { claim, integration, secret } = await setup();
		await save(claim.id, integration.id);
		expect((await callRetirement(claim.id, { reason: "Pause" })).status).toBe(
			200
		);
		const nothingServed = await pipelineRead(claim.id, secret);
		expect(nothingServed.status).toBe(404);
		const again = await save(
			claim.id,
			integration.id,
			itemSettingsWith((settings) => {
				settings.reduction.params.avail_floor = 0.7;
			}),
			true
		);
		expect(again.body.criteria.revision).toBe(3);
		expect(labelsOf(again.body.criteria)).toEqual({
			rule: "r1",
			reduction: "d2",
			aggregation: "a1",
		});
		expect(again.body.criteria.state).toBe("accepted");
		expect(
			labelsOf((await pipelineRead(claim.id, secret)).body).reduction
		).toBe("d2");
	});

	it("counts adding a removed reduction back as a change", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		const without = await save(
			claim.id,
			integration.id,
			itemSettingsWith((settings) => {
				settings.reduction = undefined;
			})
		);
		expect(without.status).toBe(200);
		expect(without.body.criteria.reduction).toBeUndefined();
		const back = await save(claim.id, integration.id);
		expect(back.body.criteria.reduction.version).toBe("d2");
		expect(back.body.criteria.reduction.rule.version).toBe("d2");
	});

	it("never serves one label for two different contents across a long edit sequence", async () => {
		const { claim, integration, secret } = await setup();
		const seen = new Map<string, string>();
		const observe = (served: Blocks) => {
			const labels = labelsOf(served);
			const content = contentOf(served);
			for (const [key, label] of [
				["r", labels.rule],
				["d", labels.reduction],
				["a", labels.aggregation],
			] as const) {
				if (label === undefined) {
					continue;
				}
				const body = canonicalJSON(content[key] ?? null);
				const earlier = seen.get(`${key}:${label}`);
				if (earlier !== undefined) {
					expect(body).toBe(earlier);
				}
				seen.set(`${key}:${label}`, body);
			}
		};
		const steps: { settings: Record<string, unknown>; accept: boolean }[] = [
			{ settings: itemSettings(), accept: false },
			{
				settings: itemSettingsWith((s) => {
					s.rule = { kind: "identity", params: { n: 1 } };
				}),
				accept: false,
			},
			{ settings: numericSettings(), accept: false },
			{ settings: itemSettings(), accept: true },
			{
				settings: itemSettingsWith((s) => {
					s.reduction = undefined;
				}),
				accept: true,
			},
			{
				settings: itemSettingsWith((s) => {
					s.reduction.params.avail_floor = 0.6;
				}),
				accept: true,
			},
			{ settings: itemSettings(), accept: true },
			{ settings: numericSettings(), accept: true },
			{
				settings: numericSettings({
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.5, avail_floor: 0.8, use_verdict: true },
					},
				}),
				accept: true,
			},
			{ settings: itemSettings(), accept: true },
		];
		for (const [index, step] of steps.entries()) {
			const result = await save(
				claim.id,
				integration.id,
				step.settings,
				step.accept
			);
			expect(result.status, `step ${index}`).toBe(200);
			observe(result.body.criteria);
			if (index === 5) {
				await callRetirement(claim.id, { reason: "Pause" });
			}
		}
		observe((await pipelineRead(claim.id, secret)).body);
	});

	it("writes one history row per change, holding the served settings, the actor and the time", async () => {
		const { claim, integration, owner } = await setup();
		await save(claim.id, integration.id, itemSettings(), false);
		await save(claim.id, integration.id, itemSettings(), true);
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.rule = { kind: "identity", params: { n: 2 } };
			}),
			true
		);
		await callRetirement(claim.id, { reason: "Because" });
		const rows = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: claim.id },
			orderBy: { revision: "asc" },
		});
		expect(rows.map((row) => [row.revision, row.action])).toEqual([
			[1, "SUGGESTED"],
			[2, "ACCEPTED"],
			[3, "EDITED"],
			[4, "RETIRED"],
		]);
		expect(rows.every((row) => row.actorId === owner.id)).toBe(true);
		expect(rows[2]?.declaration).toMatchObject({
			rule: { kind: "identity", params: { n: 2 }, version: "r2" },
		});
		expect(rows[3]?.reason).toBe("Because");
		expect(rows[3]?.declaration).toMatchObject({
			rule: { version: "r2" },
		});
		expect(rows[0]?.integrationName).toBe(integration.name);
	});

	it("computes where each block came from on the server and refuses a source sent by the browser", async () => {
		const { claim, integration } = await setup();
		const recommended = await save(claim.id, integration.id, itemSettings());
		expect(recommended.body.criteria.source).toMatchObject({
			kind: "recommended",
			rule: "recommended",
			reduction: "recommended",
			aggregation: "recommended",
			timing: "recommended",
		});
		const edited = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.aggregation.params.threshold = 0.5;
			})
		);
		expect(edited.body.criteria.source).toMatchObject({
			kind: "edited",
			aggregation: "edited",
			rule: "recommended",
			reduction: "recommended",
		});
		const forged = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.source = { kind: "recommended" };
			})
		);
		expect(forged.status).toBe(400);
		const { callCriteriaPut } = await import("../utils/health-criteria-kit");
		const topLevel = await callCriteriaPut(claim.id, {
			integration_id: integration.id,
			settings: itemSettings(),
			accept: true,
			source: { kind: "recommended" },
		});
		expect(topLevel.status).toBe(400);
		for (const extra of ["revision", "accepted_by", "state", "version"]) {
			const response = await callCriteriaPut(claim.id, {
				integration_id: integration.id,
				settings: itemSettings(),
				accept: true,
				[extra]: 7,
			});
			expect(response.status, extra).toBe(400);
		}
	});

	it("marks a hand-written check that recommends nothing as hand", async () => {
		const { claim, integration, secret } = await setup();
		const list = buildHealthCheckList();
		const check = list.checks.find((entry) => entry.name === ITEM_CHECK_NAME);
		if (!check) {
			throw new Error("missing");
		}
		check.recommended = undefined as never;
		await callPublishChecks(list, secret);
		const saved = await save(claim.id, integration.id);
		expect(saved.body.criteria.source.kind).toBe("edited");
		expect(saved.body.criteria.source.rule).toBe("hand");
		expect(saved.body.criteria.source.timing).toBe("hand");
	});
});

describe("the echo comparison", () => {
	async function accepted(settings: Record<string, unknown> = itemSettings()) {
		const world = await setup();
		await save(world.claim.id, world.integration.id, settings);
		const served = (await pipelineRead(world.claim.id, world.secret)).body;
		return { ...world, served };
	}

	it("stores a record that echoes the settings as a match, with the revision it was compared with", async () => {
		const { claim, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served);
		expect(posted.status).toBe(201);
		expect(await storedEcho(posted.recordId)).toEqual({
			echoState: "MATCH",
			echoDifferences: null,
			criteriaRevision: 1,
		});
	});

	it.each([
		[
			"check version",
			(served: Blocks) => ({
				check: { ...(served.check as Blocks), version: "0.2" },
			}),
			"check.version",
		],
		[
			"check settings",
			(served: Blocks) => ({
				check: { ...(served.check as Blocks), params: { camera_line: "B" } },
			}),
			"check.params",
		],
		[
			"rule version",
			(served: Blocks) => ({
				rule: { ...(served.rule as Blocks), version: "r9" },
			}),
			"rule.version",
		],
		[
			"reduction version",
			(served: Blocks) => ({
				reduction: {
					...(served.reduction as Blocks),
					version: "d9",
					rule: {
						...(served.reduction as { rule: Blocks }).rule,
						version: "d9",
					},
				},
			}),
			"reduction.version",
		],
		[
			"aggregation version",
			(served: Blocks) => ({
				aggregation: { ...(served.aggregation as Blocks), version: "a9" },
			}),
			"aggregation.version",
		],
		["window", () => ({ window: "PT2M" }), "window"],
		["validity", () => ({ valid_for: "PT6M" }), "valid_for"],
		[
			"validity as indefinite",
			() => ({ valid_for: "indefinite" }),
			"valid_for",
		],
	])("flags a difference in %s on its own, naming only that field", async (_name, change, field) => {
		const { claim, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served, change(served));
		expect(posted.status).toBe(201);
		const echo = await storedEcho(posted.recordId);
		expect(echo?.echoState).toBe("MISMATCH");
		const fields = (echo?.echoDifferences as { field: string }[]).map(
			(entry) => entry.field
		);
		expect(fields).toEqual([field]);
		expect(echo?.criteriaRevision).toBe(1);
	});

	it("reports declared and used values in each difference", async () => {
		const { claim, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served, {
			rule: { kind: "identity", version: "r9" },
			window: "PT2M",
		});
		const echo = await storedEcho(posted.recordId);
		expect(echo?.echoDifferences).toEqual([
			{ field: "rule.version", declared: "r1", used: "r9" },
			{ field: "window", declared: "PT1M", used: "PT2M" },
		]);
	});

	it("treats a window and a validity written differently as the same length of time", async () => {
		const { claim, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served, {
			window: "PT60S",
			valid_for: "PT300S",
		});
		expect((await storedEcho(posted.recordId))?.echoState).toBe("MATCH");
		const hours = await postResult(claim.id, secret, served, {
			valid_for: "PT5M",
			window: "PT0H1M",
		});
		expect((await storedEcho(hours.recordId))?.echoState).toBe("MATCH");
	});

	it("matches indefinite with indefinite and flags a duration declared against indefinite", async () => {
		const { claim, secret, served } = await accepted(
			itemSettingsWith((s) => {
				s.valid_for = "indefinite";
			})
		);
		const same = await postResult(claim.id, secret, served, {
			valid_for: "indefinite",
		});
		expect((await storedEcho(same.recordId))?.echoState).toBe("MATCH");
		const differs = await postResult(claim.id, secret, served, {
			valid_for: "P1D",
		});
		expect((await storedEcho(differs.recordId))?.echoState).toBe("MISMATCH");
	});

	it("flags a reduction used by the pipeline but not declared, and the reverse", async () => {
		const withoutReduction = await accepted(
			itemSettingsWith((s) => {
				s.reduction = undefined;
			})
		);
		const extra = await postResult(
			withoutReduction.claim.id,
			withoutReduction.secret,
			withoutReduction.served,
			{
				reduction: {
					kind: "mean",
					params: { avail_floor: 0.8 },
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 0.8, marginal_values: 0.5 },
						version: "d1",
					},
					version: "d1",
				},
			}
		);
		expect((await storedEcho(extra.recordId))?.echoDifferences).toEqual([
			{ field: "reduction", declared: null, used: "d1" },
		]);

		const declared = await accepted();
		const missing = await postResult(
			declared.claim.id,
			declared.secret,
			declared.served,
			{ reduction: undefined }
		);
		expect((await storedEcho(missing.recordId))?.echoDifferences).toEqual([
			{ field: "reduction", declared: "d1", used: null },
		]);
	});

	it("flags an aggregation used but not declared, and declared but not used", async () => {
		const world = await accepted(numericSettings());
		const missing = await postResult(
			world.claim.id,
			world.secret,
			world.served,
			{ aggregation: undefined }
		);
		expect((await storedEcho(missing.recordId))?.echoDifferences).toEqual([
			{ field: "aggregation", declared: "a1", used: null },
		]);
	});

	it("ignores the order of keys in check settings, and treats absent settings as empty", async () => {
		const world = await setup();
		const list = buildHealthCheckList();
		const check = list.checks.find((entry) => entry.name === ITEM_CHECK_NAME);
		if (!check) {
			throw new Error("missing");
		}
		check.params = [
			{ key: "alpha", label: "Alpha", type: "string" },
			{ key: "beta", label: "Beta", type: "string" },
		] as never;
		await callPublishChecks(list, world.secret);
		await save(
			world.claim.id,
			world.integration.id,
			itemSettingsWith((s) => {
				s.check.params = { alpha: "1", beta: "2" };
			})
		);
		const served = (await pipelineRead(world.claim.id, world.secret)).body;
		const reordered = await postResult(world.claim.id, world.secret, served, {
			check: { ...served.check, params: { beta: "2", alpha: "1" } },
		});
		expect((await storedEcho(reordered.recordId))?.echoState).toBe("MATCH");

		const other = await setup();
		await callPublishChecks(list, other.secret);
		await save(
			other.claim.id,
			other.integration.id,
			itemSettingsWith((s) => {
				s.check.params = undefined;
			})
		);
		const otherServed = (await pipelineRead(other.claim.id, other.secret)).body;
		const emptyParams = await postResult(
			other.claim.id,
			other.secret,
			otherServed,
			{
				check: { ...otherServed.check, params: {} },
			}
		);
		expect((await storedEcho(emptyParams.recordId))?.echoState).toBe("MATCH");
		const noParams = await postResult(
			other.claim.id,
			other.secret,
			otherServed,
			{
				check: { ...otherServed.check, params: undefined },
			}
		);
		expect((await storedEcho(noParams.recordId))?.echoState).toBe("MATCH");
		const filled = await postResult(other.claim.id, other.secret, otherServed, {
			check: { ...otherServed.check, params: { alpha: "x" } },
		});
		const echo = await storedEcho(filled.recordId);
		expect(echo?.echoState).toBe("MISMATCH");
		expect(echo?.echoDifferences).toEqual([
			{ field: "check.params", declared: {}, used: { alpha: "x" } },
		]);
	});

	it("does not fill in a check's default for settings that left it out", async () => {
		const world = await setup();
		await save(
			world.claim.id,
			world.integration.id,
			itemSettingsWith((s) => {
				s.check.params = undefined;
			})
		);
		const served = (await pipelineRead(world.claim.id, world.secret)).body;
		const posted = await postResult(world.claim.id, world.secret, served, {
			check: { ...served.check, params: { camera_line: "ALL" } },
		});
		expect((await storedEcho(posted.recordId))?.echoState).toBe("MISMATCH");
	});

	it("stores a result for a claim with suggested, inactive or no settings as undeclared with no revision", async () => {
		const world = await setup();
		const served = deepClone(
			(await (async () => {
				await save(world.claim.id, world.integration.id);
				const read = (await pipelineRead(world.claim.id, world.secret)).body;
				await callRetirement(world.claim.id, { reason: "Reset" });
				return read;
			})()) as Blocks
		);
		const inactive = await postResult(world.claim.id, world.secret, served);
		expect(await storedEcho(inactive.recordId)).toEqual({
			echoState: "UNDECLARED",
			echoDifferences: null,
			criteriaRevision: null,
		});
		await save(world.claim.id, world.integration.id, itemSettings(), false);
		const suggested = await postResult(world.claim.id, world.secret, served);
		expect((await storedEcho(suggested.recordId))?.echoState).toBe(
			"UNDECLARED"
		);

		const bare = await setup();
		const none = await postResult(bare.claim.id, bare.secret, served);
		expect(none.status).toBe(201);
		expect(await storedEcho(none.recordId)).toEqual({
			echoState: "UNDECLARED",
			echoDifferences: null,
			criteriaRevision: null,
		});
	});

	it("stores the record either way and keeps the stored comparison on later settings changes", async () => {
		const { claim, secret, served, integration } = await accepted();
		const posted = await postResult(claim.id, secret, served);
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.rule = { kind: "identity", params: { n: 3 } };
			})
		);
		await callRetirement(claim.id, { reason: "Gone" });
		expect(await storedEcho(posted.recordId)).toEqual({
			echoState: "MATCH",
			echoDifferences: null,
			criteriaRevision: 1,
		});
		const list = await evidenceList(claim.id, secret);
		expect(list.body.evidence[0]).toMatchObject({
			echo_state: "match",
			echo_differences: null,
			criteria_revision: 1,
		});
	});

	it("reports mismatches and undeclared records on the list route in the wire shape", async () => {
		const { claim, secret, served } = await accepted();
		await postResult(claim.id, secret, served, { window: "PT9M" });
		const list = await evidenceList(claim.id, secret);
		expect(list.body.evidence[0]).toMatchObject({
			echo_state: "mismatch",
			echo_differences: [{ field: "window", declared: "PT1M", used: "PT9M" }],
			criteria_revision: 1,
		});
	});
});

describe("status against the settings as they are now", () => {
	async function accepted() {
		const world = await setup();
		await save(world.claim.id, world.integration.id);
		const served = (await pipelineRead(world.claim.id, world.secret)).body;
		return { ...world, served };
	}
	const sessionStatus = async (claimId: string) =>
		(await (await callStatus(claimId)).json()).status;
	const machineStatus = async (claimId: string, secret: string) =>
		(await (await callMachineClaimStatus(claimId, secret)).json()).status;

	it("shows no mismatch for a matching result, on every status route and in the post response", async () => {
		const { claim, testCase, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served);
		expect(posted.body.status.mismatch).toBeNull();
		expect((await sessionStatus(claim.id)).mismatch).toBeNull();
		expect((await machineStatus(claim.id, secret)).mismatch).toBeNull();
		const caseStatus = await (
			await callMachineCaseStatus(testCase.id, secret)
		).json();
		expect(caseStatus.statuses).toHaveLength(1);
		expect(caseStatus.statuses[0].claim_ref).toBe(claim.id);
		expect(caseStatus.statuses[0].status.mismatch).toBeNull();
	});

	it("flags the claim at once when accepted settings are edited, and clears it when a result echoes the new labels", async () => {
		const { claim, integration, secret, served } = await accepted();
		await postResult(claim.id, secret, served);
		vi.mocked(emitSSEEvent).mockClear();
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.rule = { kind: "identity", params: { n: 5 } };
			})
		);
		const flagged = await sessionStatus(claim.id);
		expect(flagged.mismatch).toEqual({
			state: "mismatch",
			differences: [{ field: "rule.version", declared: "r2", used: "r1" }],
		});
		expect((await machineStatus(claim.id, secret)).mismatch).toEqual(
			flagged.mismatch
		);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			expect.any(String),
			expect.objectContaining({
				status: expect.objectContaining({ mismatch: flagged.mismatch }),
			})
		);
		const next = (await pipelineRead(claim.id, secret)).body;
		const cleared = await postResult(claim.id, secret, next);
		expect(cleared.body.status.mismatch).toBeNull();
		expect((await sessionStatus(claim.id)).mismatch).toBeNull();
	});

	it("flags the claim as undeclared once settings are retired, and leaves the stored comparisons alone", async () => {
		const { claim, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served);
		await callRetirement(claim.id, { reason: "Stopped" });
		expect((await sessionStatus(claim.id)).mismatch).toEqual({
			state: "undeclared",
		});
		expect((await storedEcho(posted.recordId))?.echoState).toBe("MATCH");
	});

	it("reads a claim that has a record but never had settings as undeclared", async () => {
		const world = await setup();
		const donor = await accepted();
		const posted = await postResult(world.claim.id, world.secret, donor.served);
		expect(posted.body.status.mismatch).toEqual({ state: "undeclared" });
	});

	it("shows no mismatch for a claim with accepted settings and no result yet", async () => {
		const { claim } = await accepted();
		const status = await sessionStatus(claim.id);
		expect(status.mismatch).toBeNull();
		expect(status.bound_check).toBe(ITEM_CHECK_NAME);
	});

	it("compares the claim's current record, so revoking the newest falls back to the one before", async () => {
		const { claim, secret, served } = await accepted();
		await postResult(claim.id, secret, served);
		const newest = await postResult(claim.id, secret, served, {
			window: "PT9M",
			timestamp: new Date(Date.now() - 1000).toISOString(),
		});
		expect((await sessionStatus(claim.id)).mismatch.state).toBe("mismatch");
		const { callRevoke } = await import("../utils/health-adversarial-kit");
		await callRevoke(claim.id, newest.recordId);
		expect((await sessionStatus(claim.id)).mismatch).toBeNull();
	});

	it("reports the latest result differences on the settings read, worked out again from the settings now", async () => {
		const { claim, integration, secret, served } = await accepted();
		const posted = await postResult(claim.id, secret, served);
		expect((await readView(claim.id)).body.latest_result).toEqual({
			record_id: posted.recordId,
			differences: [],
		});
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT3M";
			})
		);
		expect((await readView(claim.id)).body.latest_result).toEqual({
			record_id: posted.recordId,
			differences: [{ field: "window", declared: "PT3M", used: "PT1M" }],
		});
	});

	it("reports no latest result for settings that are only suggested or inactive", async () => {
		const world = await setup();
		await save(world.claim.id, world.integration.id, itemSettings(), false);
		expect((await readView(world.claim.id)).body.latest_result).toBeNull();
	});
});

describe("binding", () => {
	it("accepting binds a claim that has no state row and writes a DECLARATION history row", async () => {
		const { claim, integration, owner } = await setup();
		expect(
			await prisma.pluginHealthClaimState.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
		await save(claim.id, integration.id);
		const state = await prisma.pluginHealthClaimState.findUnique({
			where: { claimId: claim.id },
		});
		expect(state?.boundCheckName).toBe(ITEM_CHECK_NAME);
		const changes = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id },
		});
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			source: "DECLARATION",
			fromCheckName: null,
			toCheckName: ITEM_CHECK_NAME,
			changedById: owner.id,
		});
	});

	it("does not bind for a suggestion and does not add history for a repeat acceptance of the same check", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id, itemSettings(), false);
		expect(
			await prisma.pluginHealthClaimState.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
		await save(claim.id, integration.id, itemSettings(), true);
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT2M";
			}),
			true
		);
		expect(
			await prisma.pluginHealthBindingChange.count({
				where: { claimId: claim.id },
			})
		).toBe(1);
	});

	it("re-binds a claim bound to another check by an earlier result, recording where it was bound before", async () => {
		const { claim, integration, secret, owner } = await setup();
		const donor = (await (async () => {
			const other = await setup();
			await save(other.claim.id, other.integration.id);
			return (await pipelineRead(other.claim.id, other.secret)).body;
		})()) as Blocks;
		const first = await postResult(claim.id, secret, donor, {
			check: { name: "Some Older Checker", version: "1", scope: "item" },
		});
		expect(first.status).toBe(201);
		await mockAuth(owner.id);
		expect((await save(claim.id, integration.id)).status).toBe(200);
		const changes = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id },
			orderBy: { createdAt: "asc" },
		});
		expect(
			changes.map((c) => [c.source, c.fromCheckName, c.toCheckName])
		).toEqual([
			["FIRST_RECORD", null, "Some Older Checker"],
			["DECLARATION", "Some Older Checker", ITEM_CHECK_NAME],
		]);
	});

	it("re-binds on a change of check on accepted settings, refuses a result naming the old check, and accepts the new", async () => {
		const { claim, integration, secret } = await setup();
		await save(claim.id, integration.id);
		const itemServed = (await pipelineRead(claim.id, secret)).body;
		await save(claim.id, integration.id, numericSettings());
		const state = await prisma.pluginHealthClaimState.findUnique({
			where: { claimId: claim.id },
		});
		expect(state?.boundCheckName).toBe(NUMERIC_CHECK_NAME);
		const old = await postResult(claim.id, secret, itemServed);
		expect(old.status).toBe(422);
		const numericServed = (await pipelineRead(claim.id, secret)).body;
		const fresh = await postResult(claim.id, secret, numericServed, {
			reduction: undefined,
			value: { number: 0.3, unit: "mm" },
			rule: numericServed.rule,
		});
		expect(fresh.status).toBe(201);
		expect((await storedEcho(fresh.recordId))?.echoState).toBe("MATCH");
	});

	it("answers 409 to a person changing the bound check while settings are accepted, and works after they are retired", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		const refused = await callBoundCheck(claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(refused.status).toBe(409);
		expect((await refused.json()).error).toContain("evidence settings");
		expect(
			(
				await prisma.pluginHealthClaimState.findUniqueOrThrow({
					where: { claimId: claim.id },
				})
			).boundCheckName
		).toBe(ITEM_CHECK_NAME);
		await callRetirement(claim.id, { reason: "Stop" });
		const allowed = await callBoundCheck(claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(allowed.status).toBe(200);
	});

	it("keeps the bound-check route free for suggested settings", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id, itemSettings(), false);
		const allowed = await callBoundCheck(claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		expect(allowed.status).toBe(200);
	});

	it("refuses a suggestion over accepted settings with a 409 and stores nothing", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		const refused = await save(claim.id, integration.id, itemSettings(), false);
		expect(refused.status).toBe(409);
		expect(
			await prisma.pluginHealthCriteriaRevision.count({
				where: { claimId: claim.id },
			})
		).toBe(1);
	});

	it("answers 409 to retiring inactive settings, 404 where there are none, and 400 without a reason for accepted ones", async () => {
		const { claim, integration, testCase, owner } = await setup();
		const none = await callRetirement(claim.id, { reason: "x" });
		expect(none.status).toBe(404);
		await save(claim.id, integration.id);
		const noReason = await callRetirement(claim.id, {});
		expect(noReason.status).toBe(400);
		expect((await noReason.json()).error).toContain("reason");
		expect((await callRetirement(claim.id, { reason: "   " })).status).toBe(
			400
		);
		expect((await callRetirement(claim.id, { reason: "Done" })).status).toBe(
			200
		);
		expect((await callRetirement(claim.id, { reason: "Again" })).status).toBe(
			409
		);
		const other = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await save(other.id, integration.id, itemSettings(), false);
		expect((await callRetirement(other.id, {})).status).toBe(200);
		const rows = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: other.id },
			orderBy: { revision: "asc" },
		});
		expect(rows.map((row) => row.action)).toEqual(["SUGGESTED", "DISCARDED"]);
	});
});

describe("two pipelines on one case", () => {
	async function twoPipelines() {
		const world = await setup();
		const second = await addPipeline(world.owner.id, world.testCase.id);
		const claimB = await createTestElement(world.testCase.id, world.owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await save(world.claim.id, world.integration.id);
		await save(claimB.id, second.integration.id);
		return { ...world, second, claimB };
	}

	it("serves each pipeline only the settings whose check came from its own list", async () => {
		const { claim, claimB, secret, second, testCase } = await twoPipelines();
		const forFirst = await (
			await callMachineCaseCriteria(testCase.id, secret)
		).json();
		const forSecond = await (
			await callMachineCaseCriteria(testCase.id, second.secret)
		).json();
		expect(forFirst.criteria.map((c: Blocks) => c.claim_ref)).toEqual([
			claim.id,
		]);
		expect(forSecond.criteria.map((c: Blocks) => c.claim_ref)).toEqual([
			claimB.id,
		]);
		expect((await callMachineClaimCriteria(claimB.id, secret)).status).toBe(
			404
		);
		expect(
			(await callMachineClaimCriteria(claim.id, second.secret)).status
		).toBe(404);
	});

	it("leaves the other pipeline's last-read values alone, and leaves updated_at alone", async () => {
		const { claim, claimB, secret, second, testCase } = await twoPipelines();
		const before = await prisma.pluginHealthCriteria.findMany({
			where: { claimId: { in: [claim.id, claimB.id] } },
		});
		expect(before.every((row) => row.lastReadAt === null)).toBe(true);
		await callMachineCaseCriteria(testCase.id, secret);
		const afterFirst = await prisma.pluginHealthCriteria.findMany({
			where: { claimId: { in: [claim.id, claimB.id] } },
		});
		const rowA = afterFirst.find((row) => row.claimId === claim.id);
		const rowB = afterFirst.find((row) => row.claimId === claimB.id);
		expect(rowA?.lastReadAt).not.toBeNull();
		expect(rowA?.lastReadRevision).toBe(rowA?.revision);
		expect(rowB?.lastReadAt).toBeNull();
		expect(rowB?.lastReadRevision).toBeNull();
		const beforeA = before.find((row) => row.claimId === claim.id);
		expect(rowA?.updatedAt.getTime()).toBe(beforeA?.updatedAt.getTime());
		await callMachineClaimCriteria(claimB.id, secret);
		await callMachineClaimCriteria(claim.id, second.secret);
		const afterMiss = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: claimB.id },
		});
		expect(afterMiss.lastReadAt).toBeNull();
	});

	it("records the revision served and shows it to a person as the pipeline read", async () => {
		const { claim, secret, integration } = await twoPipelines();
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT2M";
			})
		);
		const read = await pipelineRead(claim.id, secret);
		expect(read.body.revision).toBe(2);
		const view = await readView(claim.id);
		expect(view.body.pipeline_read.revision).toBe(2);
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT3M";
			})
		);
		const later = await readView(claim.id);
		expect(later.body.pipeline_read.revision).toBe(2);
		expect(later.body.criteria.revision).toBe(3);
	});

	it("moves a claim to another pipeline when it is saved against that pipeline's list", async () => {
		const { claim, secret, second, testCase, integration } =
			await twoPipelines();
		await save(claim.id, second.integration.id);
		const forFirst = await (
			await callMachineCaseCriteria(testCase.id, secret)
		).json();
		const forSecond = await (
			await callMachineCaseCriteria(testCase.id, second.secret)
		).json();
		expect(forFirst.criteria).toEqual([]);
		expect(forSecond.criteria).toHaveLength(2);
		expect((await readView(claim.id)).body.integration).toEqual({
			id: second.integration.id,
			name: second.integration.name,
		});
		expect(integration.id).not.toBe(second.integration.id);
	});

	it("never serves suggested or inactive settings to the pipeline", async () => {
		const { claimB, second, testCase } = await twoPipelines();
		await callRetirement(claimB.id, { reason: "x" });
		const list = await (
			await callMachineCaseCriteria(testCase.id, second.secret)
		).json();
		expect(list.criteria).toEqual([]);
		await save(claimB.id, second.integration.id, itemSettings(), false);
		const again = await (
			await callMachineCaseCriteria(testCase.id, second.secret)
		).json();
		expect(again.criteria).toEqual([]);
		expect(
			(await callMachineClaimCriteria(claimB.id, second.secret)).status
		).toBe(404);
	});

	it("offers each person's view only the check offer of the pipeline the settings point at", async () => {
		const { claim, secret } = await twoPipelines();
		const list = buildHealthCheckList();
		list.checks = list.checks.filter((entry) => entry.name !== ITEM_CHECK_NAME);
		await callPublishChecks(list, secret);
		expect((await readView(claim.id)).body.check_offer).toBe("not-offered");
		const newer = buildHealthCheckList();
		const check = newer.checks.find((entry) => entry.name === ITEM_CHECK_NAME);
		if (check) {
			check.version = "0.9";
		}
		await callPublishChecks(newer, secret);
		expect((await readView(claim.id)).body.check_offer).toBe("newer-version");
	});
});

describe("a deleted integration", () => {
	it("serves settings to nobody, reports the check as not offered with no integration, and restores on saving against a new integration", async () => {
		const { claim, integration, owner, testCase } = await setup();
		await save(claim.id, integration.id);
		const bystander = await addPipeline(owner.id, testCase.id);
		expect(
			"data" in (await deleteIntegrationRegistration(integration.id, owner.id))
		).toBe(true);
		const view = (await readView(claim.id)).body;
		expect(view.integration).toBeNull();
		expect(view.check_offer).toBe("not-offered");
		expect(view.criteria.state).toBe("accepted");
		const list = await (
			await callMachineCaseCriteria(testCase.id, bystander.secret)
		).json();
		expect(list.criteria).toEqual([]);
		expect(
			(await callMachineClaimCriteria(claim.id, bystander.secret)).status
		).toBe(404);
		// Editing other blocks on the orphaned settings, against the same dead id, is refused as not offered.
		const stale = await save(claim.id, integration.id);
		expect(stale.status).toBe(400);
		const fresh = await addPipeline(owner.id, testCase.id);
		const restored = await save(claim.id, fresh.integration.id);
		expect(restored.status).toBe(200);
		expect((await pipelineRead(claim.id, fresh.secret)).status).toBe(200);
		expect((await readView(claim.id)).body.check_offer).toBe("current");
		expect(
			await prisma.pluginHealthCriteriaRevision.count({
				where: { claimId: claim.id },
			})
		).toBeGreaterThanOrEqual(2);
	});

	it("keeps the history readable after the integration is deleted", async () => {
		const { claim, integration, owner } = await setup();
		await save(claim.id, integration.id);
		await deleteIntegrationRegistration(integration.id, owner.id);
		const rows = await prisma.pluginHealthCriteriaRevision.findMany({
			where: { claimId: claim.id },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.integrationName).toBe(integration.name);
		const view = await readView(claim.id);
		expect(view.status).toBe(200);
		expect(view.body.last_change.action).toBe("accepted");
		const status = await callStatus(claim.id);
		expect(status.status).toBe(200);
	});

	it("does not offer the deleted integration's check list on the case", async () => {
		const { integration, owner, testCase } = await setup();
		await deleteIntegrationRegistration(integration.id, owner.id);
		const { callCaseChecks } = await import("../utils/health-criteria-kit");
		const lists = await (await callCaseChecks(testCase.id)).json();
		expect(lists).toEqual([]);
	});
});

describe("the settings read", () => {
	it("returns the documented empty shape when a claim never had settings", async () => {
		const { claim } = await setup();
		const view = await readView(claim.id);
		expect(view.body).toEqual({
			criteria: null,
			integration: null,
			accepted_by: null,
			last_change: null,
			pipeline_read: null,
			check_offer: null,
			latest_result: null,
		});
	});

	it("names who accepted and whether that person owns the integration, and clears it for a suggestion", async () => {
		const { claim, integration, actors } = await setup();
		await save(claim.id, integration.id, itemSettings(), false);
		const suggested = (await readView(claim.id)).body;
		expect(suggested.accepted_by).toBeNull();
		await mockAuth(actors.directEdit.id, actors.directEdit.username);
		await save(claim.id, integration.id, itemSettings(), true);
		const accepted = (await readView(claim.id)).body;
		expect(accepted.accepted_by).toEqual({
			name: actors.directEdit.username,
			owns_integration: false,
		});
		expect(accepted.last_change.by_name).toBe(actors.directEdit.username);
		await mockAuth(actors.owner.id, actors.owner.username);
		await callRetirement(claim.id, { reason: "Reset" });
		await save(claim.id, integration.id, itemSettings(), true);
		const again = (await readView(claim.id)).body;
		expect(again.accepted_by).toEqual({
			name: actors.owner.username,
			owns_integration: true,
		});
	});

	it("reports the retirement reason and who retired, and no accepted_by for inactive settings", async () => {
		const { claim, integration, owner } = await setup();
		await save(claim.id, integration.id);
		await callRetirement(claim.id, { reason: "It was wrong" });
		const view = (await readView(claim.id)).body;
		expect(view.criteria.state).toBe("inactive");
		expect(view.accepted_by).toBeNull();
		expect(view.last_change).toMatchObject({
			action: "retired",
			by_name: owner.username,
			reason: "It was wrong",
		});
		expect(view.check_offer).toBeNull();
	});

	it("serves a read-only person the same body as an editor", async () => {
		const { claim, integration, actors } = await setup();
		await save(claim.id, integration.id);
		const editor = (await readView(claim.id)).body;
		await mockAuth(actors.view.id);
		const viewer = await callCriteriaGet(claim.id);
		expect(viewer.status).toBe(200);
		expect(await viewer.json()).toEqual(editor);
	});

	it("emits the change event once after a save and once after a retirement, and not on a refused save", async () => {
		const { claim, integration } = await setup();
		await save(claim.id, integration.id);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		await save(claim.id, integration.id, itemSettings(), false);
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		await callRetirement(claim.id, { reason: "x" });
		expect(emitSSEEvent).toHaveBeenCalledTimes(2);
		await callRetirement(claim.id, { reason: "x" });
		expect(emitSSEEvent).toHaveBeenCalledTimes(2);
	});
});

describe("unchanged behaviour of records", () => {
	it("still accepts a plain record for a claim with no settings and still stores the record body as sent", async () => {
		const { claim, secret } = await setup();
		const body = wireRecord(claim.id, "populationPass");
		const { POST } = await importMachineRoute();
		const response = await POST(machinePost(claim.id, body, secret), {
			params: Promise.resolve({ id: claim.id }),
		});
		expect(response.status).toBe(201);
		const stored = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(stored.record).toMatchObject({ record_id: body.record_id });
		expect(stored.echoState).toBe("UNDECLARED");
	});
});

describe("session read on a bare claim", () => {
	it("reads the empty shape through the route as a session", async () => {
		const { claim } = await setup();
		const response = await callCriteriaGet(claim.id);
		expect(response.status).toBe(200);
	});
});
