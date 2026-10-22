/**
 * The shared demo account for the staging environment.
 *
 * `seedDemoAccount` creates one account, `demo`, with the Case Assistant and
 * Health plugins on, the cases listed in `DEMO_FIXTURES`, an OpenRouter model
 * connection and a machine integration whose token the DARTER pipeline is
 * configured with. The integration is granted the Bluebird case only. It
 * attaches no checks to the cases and records no evidence results; whoever
 * runs the demo adds those.
 *
 * The Bluebird case is imported first, then the model connection and the
 * integration (with its token and grant) are created, and the showcase cases
 * are imported last, in list order.
 *
 * It expects a freshly reset database. If the `demo` user already exists it
 * changes nothing. A list that does not hold exactly one Bluebird entry is
 * refused before anything is written. A run that fails part-way leaves what
 * it had written: when a showcase file is broken, the account holds the user,
 * the plugins, the Bluebird case, the connection, the integration with its
 * token and grant, and the showcase cases listed before the broken file, and
 * the seed fails naming that file. The next reset removes the account.
 *
 * `readDemoAccountValues` checks the environment without touching the
 * database. The modules that open a connection when they load are imported
 * inside `seedDemoAccount`, because `lib/prisma` throws at load when
 * DATABASE_URL is unset and the missing values should be named together.
 *
 * Nothing here prints a password, key or token.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import {
	hashApiTokenSecret,
	tokenDisplayPrefix,
} from "../../lib/auth/api-token-service";
import { isValidEncryptionKey } from "../../lib/auth/token-encryption";
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

const FIXTURE_DIR = join(__dirname, "fixtures");

/** A case file the demo account is seeded with. */
export interface DemoFixture {
	/** The id the imported case always gets. */
	caseId: string;
	/**
	 * The file's name in `prisma/seed/fixtures/`. A path that is already
	 * absolute is used as it stands.
	 */
	file: string;
}

/**
 * The cases the demo account holds, each under its own fixed id. The Bluebird
 * entry must stay, once: the pipeline integration is granted that case, and
 * only that case, and it is imported before the others. Every other entry is
 * a showcase case, imported in this order. To add one, put its file in
 * `prisma/seed/fixtures/` and add an entry here.
 */
export const DEMO_FIXTURES: readonly DemoFixture[] = [
	{ file: "bluebird-demo-case.json", caseId: DEMO_CASE_ID },
	{
		file: "security-demo-case.json",
		caseId: "7a33ef25-9e2b-493f-96f6-5f8d42e354f7",
	},
	{
		file: "explainability-demo-case.json",
		caseId: "d1592017-1adb-4eae-95a0-017651a147cb",
	},
];

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

/** A case the seed imported, with the fixture file it came from. */
export interface ImportedDemoCase {
	caseId: string;
	file: string;
}

/**
 * `caseId` is the Bluebird case; `showcaseCases` are the other cases the
 * demo account holds, in the order they were imported.
 */
export type DemoAccountResult =
	| { caseId: string; showcaseCases: ImportedDemoCase[]; status: "created" }
	| { status: "exists" };

/** A failure whose message is safe to print: it never contains a secret. */
export class DemoSeedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DemoSeedError";
	}
}

type EnvName = (typeof REQUIRED_ENV)[number];

/** A token as issued: `teap_` and 32 random bytes in base64url. */
const ISSUED_TOKEN_SHAPE = /^teap_[A-Za-z0-9_-]{43}$/;

function passwordProblem(value: string): string | undefined {
	const check = passwordSchema.safeParse(value);
	if (check.success) {
		return;
	}
	const reasons = check.error.issues.map((issue) => issue.message);
	return `DEMO_ACCOUNT_PASSWORD does not meet the password rules: ${reasons.join("; ")}`;
}

function tokenProblem(value: string): string | undefined {
	return ISSUED_TOKEN_SHAPE.test(value)
		? undefined
		: "DEMO_PIPELINE_TOKEN is not a TEA API token as issued";
}

function encryptionKeyProblem(value: string): string | undefined {
	return isValidEncryptionKey(value)
		? undefined
		: "TOKEN_ENCRYPTION_KEY must be base64 encoding exactly 32 bytes";
}

/** The checks on a value's content, for the variables that have rules beyond being present. */
const CONTENT_CHECKS: Partial<
	Record<EnvName, (value: string) => string | undefined>
> = {
	DEMO_ACCOUNT_PASSWORD: passwordProblem,
	DEMO_PIPELINE_TOKEN: tokenProblem,
	TOKEN_ENCRYPTION_KEY: encryptionKeyProblem,
};

/**
 * What is wrong with `value`, naming `name` and never the value. Padding is
 * refused rather than trimmed: a secret with a stray newline passes every
 * content check and then fails at the other end without a message.
 */
function problemWith(name: EnvName, value: string): string | undefined {
	if (value !== value.trim()) {
		return `${name} must not start or end with whitespace`;
	}
	return CONTENT_CHECKS[name]?.(value);
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

	const problems: string[] = [];
	for (const name of REQUIRED_ENV) {
		const problem = problemWith(name, env[name] ?? "");
		if (problem) {
			problems.push(problem);
		}
	}
	if (problems.length > 0) {
		return { problems };
	}
	return {
		values: {
			password: env.DEMO_ACCOUNT_PASSWORD ?? "",
			openRouterKey: env.DEMO_OPENROUTER_API_KEY ?? "",
			pipelineToken: env.DEMO_PIPELINE_TOKEN ?? "",
		},
	};
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

type DatabaseModules = Awaited<ReturnType<typeof loadDatabaseModules>>;

/**
 * The parsed contents of a fixture file. A failure names the file and says
 * what kind of failure it was, and never repeats the file's text.
 */
function readFixture(file: string): unknown {
	try {
		return JSON.parse(readFileSync(resolve(FIXTURE_DIR, file), "utf-8"));
	} catch (error) {
		const reason =
			error instanceof SyntaxError
				? "it is not valid JSON"
				: "it could not be read";
		throw new DemoSeedError(`Could not import ${file}: ${reason}`);
	}
}

/** Imports one fixture for `userId` under its fixed case id. */
async function importDemoCase(
	importCase: DatabaseModules["importCase"],
	userId: string,
	{ file, caseId }: DemoFixture
): Promise<ImportedDemoCase> {
	const imported = await importCase(userId, readFixture(file), {
		fixedIds: { caseId },
	});
	if ("error" in imported) {
		throw new DemoSeedError(
			`Could not import ${file}: ${[imported.error, ...(imported.validationErrors ?? [])].join("; ")}`
		);
	}
	return { file, caseId: imported.data.caseId };
}

/** Imports each fixture for `userId`, in order, under its fixed case id. */
async function importDemoCases(
	importCase: DatabaseModules["importCase"],
	userId: string,
	fixtures: readonly DemoFixture[]
): Promise<ImportedDemoCase[]> {
	const cases: ImportedDemoCase[] = [];
	for (const fixture of fixtures) {
		cases.push(await importDemoCase(importCase, userId, fixture));
	}
	return cases;
}

/**
 * Separates the Bluebird entry from the showcase entries, which keep their
 * list order. A list without exactly one Bluebird entry is refused, because
 * the pipeline integration is granted that case and two entries would import
 * it twice under one id.
 */
function splitBluebird(fixtures: readonly DemoFixture[]): {
	bluebird: DemoFixture;
	showcases: DemoFixture[];
} {
	const bluebirds = fixtures.filter(
		(fixture) => fixture.caseId === DEMO_CASE_ID
	);
	const [bluebird] = bluebirds;
	if (!bluebird) {
		throw new DemoSeedError(
			`The Bluebird case is missing from the demo case list: no entry has the case id ${DEMO_CASE_ID}`
		);
	}
	if (bluebirds.length > 1) {
		throw new DemoSeedError(
			`The Bluebird case is in the demo case list more than once: ${bluebirds.map((fixture) => fixture.file).join(", ")} all have the case id ${DEMO_CASE_ID}`
		);
	}
	return {
		bluebird,
		showcases: fixtures.filter((fixture) => fixture !== bluebird),
	};
}

/**
 * Adds the OpenRouter connection, the pipeline's machine integration with its
 * token, and the integration's EDIT grant on the Bluebird case.
 */
async function wirePipeline(
	modules: DatabaseModules,
	values: DemoAccountValues,
	userId: string
): Promise<void> {
	const connection = await modules.createConnectionWithJobs(
		userId,
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

	const registered = await modules.registerIntegration(
		{
			name: DEMO_INTEGRATION_NAME,
			description: DEMO_INTEGRATION_DESCRIPTION,
			scopes: [...DEMO_PIPELINE_SCOPES],
		},
		userId
	);
	if ("error" in registered) {
		throw new DemoSeedError(
			`Could not register the pipeline integration: ${registered.error}`
		);
	}
	await modules.prisma.apiToken.create({
		data: {
			integrationId: registered.data.integration.id,
			tokenHash: hashApiTokenSecret(values.pipelineToken),
			tokenPrefix: tokenDisplayPrefix(values.pipelineToken),
		},
	});
	await modules.ensureDarterCaseGrant(
		DEMO_CASE_ID,
		registered.data.systemUserId,
		"EDIT",
		userId
	);
}

/**
 * Creates the demo account, or does nothing if a `demo` user exists.
 * Needs DATABASE_URL and TOKEN_ENCRYPTION_KEY in the environment. `fixtures`
 * is the list of cases to import; only a test passes another.
 */
export async function seedDemoAccount(
	values: DemoAccountValues,
	fixtures: readonly DemoFixture[] = DEMO_FIXTURES
): Promise<DemoAccountResult> {
	const { bluebird, showcases } = splitBluebird(fixtures);
	const modules = await loadDatabaseModules();
	const { prisma, importCase, setPluginEnabledForUser } = modules;

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

	await importDemoCase(importCase, user.id, bluebird);
	await wirePipeline(modules, values, user.id);
	const showcaseCases = await importDemoCases(importCase, user.id, showcases);

	return {
		status: "created",
		caseId: DEMO_CASE_ID,
		showcaseCases,
	};
}
