/**
 * The shared demo account for the staging environment.
 *
 * `seedDemoAccount` creates one account, `demo`, with the Case Assistant and
 * Health plugins on, the Bluebird demo case, an OpenRouter model connection
 * and a machine integration whose token the DARTER pipeline is configured
 * with. It attaches no checks to the case and records no evidence; whoever
 * runs the demo adds those.
 *
 * It expects a freshly reset database. If the `demo` user already exists it
 * changes nothing. A run that fails part-way leaves a partial account, which
 * the next reset removes.
 *
 * `readDemoAccountValues` checks the environment without touching the
 * database. The modules that open a connection when they load are imported
 * inside `seedDemoAccount`, because `lib/prisma` throws at load when
 * DATABASE_URL is unset and the missing values should be named together.
 *
 * Nothing here prints a password, key or token.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import {
	hashApiTokenSecret,
	looksLikeApiToken,
	tokenDisplayPrefix,
} from "../../lib/auth/api-token-service";
import { MODEL_JOBS } from "../../lib/models/connection-types";
import { recommendedModel } from "../../lib/models/recommended";
import { passwordSchema } from "../../lib/schemas/user";
import type { NewJobModels } from "../../lib/services/model-connection-service";
import { TOUR_IDS } from "../../lib/tours";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEMO_USERNAME = "demo";
const DEMO_EMAIL = "demo@example.com";

/** The id the demo case always gets, so the pipeline's configuration can name it. */
export const DEMO_CASE_ID = "c557f324-f2a8-41cd-87c5-6a662fefff9f";

export const DEMO_INTEGRATION_NAME = "DARTER pipeline (demo account)";
const DEMO_INTEGRATION_DESCRIPTION =
	"DARTER evidence pipeline for the shared demo account";
/** The scopes the DARTER pipeline uses: publish its check list, read criteria, post evidence. */
export const DEMO_PIPELINE_SCOPES = [
	"health:checks:write",
	"health:criteria:read",
	"health:evidence:write",
] as const;

const DEMO_PLUGIN_IDS = ["tea.health", "tea.assistant"] as const;
const DEMO_CONNECTION_LABEL = "OpenRouter";

const FIXTURE_PATH = join(__dirname, "fixtures", "bluebird-demo-case.json");

/** The environment variables the demo account is built from. */
const REQUIRED_ENV = [
	"DATABASE_URL",
	"DEMO_ACCOUNT_PASSWORD",
	"DEMO_OPENROUTER_API_KEY",
	"DEMO_PIPELINE_TOKEN",
	"TOKEN_ENCRYPTION_KEY",
] as const;

/**
 * The secrets the demo account is built from. The database address and the
 * encryption key are read from the environment by the application modules
 * themselves.
 */
export interface DemoAccountValues {
	openRouterKey: string;
	password: string;
	pipelineToken: string;
}

export type DemoAccountResult =
	| { caseId: string; status: "created" }
	| { status: "exists" };

/** A failure whose message is safe to print: it never contains a secret. */
export class DemoSeedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DemoSeedError";
	}
}

/**
 * Reads the demo account's values from `env`. Returns every problem found,
 * each naming the variable and never its value.
 */
export function readDemoAccountValues(
	env: Record<string, string | undefined>
): { values: DemoAccountValues } | { problems: string[] } {
	const missing = REQUIRED_ENV.filter((name) => !env[name]);
	if (missing.length > 0) {
		return {
			problems: [`Missing environment variables: ${missing.join(", ")}`],
		};
	}

	const password = env.DEMO_ACCOUNT_PASSWORD ?? "";
	const openRouterKey = env.DEMO_OPENROUTER_API_KEY ?? "";
	const pipelineToken = env.DEMO_PIPELINE_TOKEN ?? "";

	const problems: string[] = [];
	const passwordCheck = passwordSchema.safeParse(password);
	if (!passwordCheck.success) {
		const reasons = passwordCheck.error.issues.map((issue) => issue.message);
		problems.push(
			`DEMO_ACCOUNT_PASSWORD does not meet the password rules: ${reasons.join("; ")}`
		);
	}
	if (!looksLikeApiToken(pipelineToken)) {
		problems.push("DEMO_PIPELINE_TOKEN is not a TEA API token");
	}
	if (problems.length > 0) {
		return { problems };
	}
	return { values: { password, openRouterKey, pipelineToken } };
}

/** The recommended OpenRouter model for each job; a job with none is left out. */
function recommendedJobs(): NewJobModels {
	const models: NewJobModels = {};
	for (const job of MODEL_JOBS) {
		const model = recommendedModel("OPENROUTER", job);
		if (model) {
			models[job] = model;
		}
	}
	return models;
}

/** Loads the modules that need DATABASE_URL at load time. */
async function loadDatabaseModules() {
	const [
		{ prisma },
		{ importCase },
		{ createConnectionWithJobs },
		{ ensureDarterCaseGrant },
		{ registerIntegration },
		{ setPluginEnabledForUser },
	] = await Promise.all([
		import("../../lib/prisma"),
		import("../../lib/services/case-import-service"),
		import("../../lib/services/model-connection-service"),
		import("../../lib/services/darter-integration-service"),
		import("../../lib/services/integration-registry-service"),
		import("../../lib/services/plugin-enablement-service"),
	]);
	return {
		prisma,
		importCase,
		createConnectionWithJobs,
		ensureDarterCaseGrant,
		registerIntegration,
		setPluginEnabledForUser,
	};
}

/**
 * Creates the demo account, or does nothing if a `demo` user exists.
 * Needs DATABASE_URL and TOKEN_ENCRYPTION_KEY in the environment.
 */
export async function seedDemoAccount(
	values: DemoAccountValues
): Promise<DemoAccountResult> {
	const {
		prisma,
		importCase,
		createConnectionWithJobs,
		ensureDarterCaseGrant,
		registerIntegration,
		setPluginEnabledForUser,
	} = await loadDatabaseModules();

	const existing = await prisma.user.findUnique({
		where: { username: DEMO_USERNAME },
		select: { id: true },
	});
	if (existing) {
		return { status: "exists" };
	}

	const passwordHash = await argon2.hash(values.password, {
		type: argon2.argon2id,
		memoryCost: 65_536,
		timeCost: 3,
		parallelism: 4,
	});
	const user = await prisma.user.create({
		data: {
			email: DEMO_EMAIL,
			username: DEMO_USERNAME,
			passwordHash,
			passwordAlgorithm: "argon2id", // pragma: allowlist secret
			authProvider: "LOCAL",
			emailVerified: true,
			completedTours: [...TOUR_IDS],
			hasSeenMigrationNotice: true,
		},
		select: { id: true },
	});

	for (const pluginId of DEMO_PLUGIN_IDS) {
		const enabled = await setPluginEnabledForUser(pluginId, user.id, {
			enabled: true,
		});
		if ("error" in enabled) {
			throw new DemoSeedError(
				`Could not turn on ${pluginId}: ${enabled.error}`
			);
		}
	}

	const fixture: unknown = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
	const imported = await importCase(user.id, fixture, {
		fixedIds: { caseId: DEMO_CASE_ID },
	});
	if ("error" in imported) {
		throw new DemoSeedError(
			`Could not import the demo case: ${[imported.error, ...(imported.validationErrors ?? [])].join("; ")}`
		);
	}

	const connection = await createConnectionWithJobs(
		user.id,
		{
			label: DEMO_CONNECTION_LABEL,
			type: "OPENROUTER",
			apiKey: values.openRouterKey,
		},
		recommendedJobs()
	);
	if ("error" in connection) {
		throw new DemoSeedError(
			`Could not add the model connection: ${connection.error}`
		);
	}

	const registered = await registerIntegration(
		{
			name: DEMO_INTEGRATION_NAME,
			description: DEMO_INTEGRATION_DESCRIPTION,
			scopes: [...DEMO_PIPELINE_SCOPES],
		},
		user.id
	);
	if ("error" in registered) {
		throw new DemoSeedError(
			`Could not register the pipeline integration: ${registered.error}`
		);
	}
	await prisma.apiToken.create({
		data: {
			integrationId: registered.data.integration.id,
			tokenHash: hashApiTokenSecret(values.pipelineToken),
			tokenPrefix: tokenDisplayPrefix(values.pipelineToken),
		},
	});
	await ensureDarterCaseGrant(
		imported.data.caseId,
		registered.data.systemUserId,
		"EDIT",
		user.id
	);

	return { status: "created", caseId: imported.data.caseId };
}
