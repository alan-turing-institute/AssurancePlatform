import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import { describe, expect, it } from "vitest";

/**
 * The commit-analyzer and release-notes-generator entries in .releaserc.json
 * both load a conventional-changelog preset. These call the real plugins,
 * with the repository's own config, against fixed commits — proving the
 * configured preset and writer actually produce a release type and notes
 * sections, not just that the config parses.
 */

type PluginTuple = [string, Record<string, unknown>];

function loadPluginConfig(pluginName: string): Record<string, unknown> {
	const releaseConfig = JSON.parse(
		readFileSync(path.resolve(process.cwd(), ".releaserc.json"), "utf8")
	) as { plugins: (string | PluginTuple)[] };

	const entry = releaseConfig.plugins.find(
		(plugin): plugin is PluginTuple =>
			Array.isArray(plugin) && plugin[0] === pluginName
	);

	if (!entry) {
		throw new Error(`${pluginName} is not configured in .releaserc.json`);
	}

	return entry[1];
}

const FEATURE_COMMIT = {
	hash: "a".repeat(40),
	message: "feat: add private case media route",
};
const FIX_COMMIT = {
	hash: "b".repeat(40),
	message: "fix: return a validation error when a feature image is refused",
};
const CHORE_COMMIT = {
	hash: "c".repeat(40),
	message: "chore: tidy up",
};

const commits = [FEATURE_COMMIT, FIX_COMMIT, CHORE_COMMIT];
const context = {
	cwd: process.cwd(),
	env: {},
	options: {
		repositoryUrl:
			"https://github.com/alan-turing-institute/AssurancePlatform.git",
	},
	commits,
	lastRelease: { gitTag: "v1.0.0", version: "1.0.0" },
	nextRelease: { gitTag: "v1.1.0", version: "1.1.0" },
	// The plugins log through these; the test only cares about their return value.
	logger: {
		log() {
			return;
		},
		error() {
			return;
		},
	},
};

describe("release configuration", () => {
	it("derives a minor release from a feature commit", async () => {
		const releaseType = await analyzeCommits(
			loadPluginConfig("@semantic-release/commit-analyzer"),
			context
		);

		expect(releaseType).toBe("minor");
	});

	it("renders feature and fix sections, and omits the chore commit", async () => {
		const notes = await generateNotes(
			loadPluginConfig("@semantic-release/release-notes-generator"),
			context
		);

		expect(notes).toContain("### ✨ Features");
		expect(notes).toContain("### 🐛 Bug Fixes");
		expect(notes).toContain(FEATURE_COMMIT.message.replace("feat: ", ""));
		expect(notes).toContain(FIX_COMMIT.message.replace("fix: ", ""));
		expect(notes).not.toContain(CHORE_COMMIT.message.replace("chore: ", ""));
	});
});
