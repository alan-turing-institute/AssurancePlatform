// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createPublishedRow } from "../utils/pattern-start-kit";
import { createTestUser } from "../utils/prisma-factories";
import {
	addSandboxVariables,
	DEFAULT_OWNER,
	ID,
	MEANING,
	makePatternWithVariables,
	publishedScenario,
	snapshotOf,
} from "../utils/variable-values-kit";

/**
 * The Discover page of a published item, rendered from the database for a
 * visitor with no session: a published pattern lists its variables beside
 * "Use this pattern", from its frozen snapshot; nothing else does.
 */

const session = vi.hoisted(() => ({
	status: "unauthenticated" as "authenticated" | "loading" | "unauthenticated",
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data:
			session.status === "authenticated" ? { user: { id: "user-1" } } : null,
		status: session.status,
	}),
}));

const readSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: readSession.mockRejectedValue(
		new Error("a public page must not read a session")
	),
}));

const DEFAULT_VALUE_LABEL = /Default value/;
const VARIABLES_HEADING = { name: "Variables" };
const USE_THIS_PATTERN = { name: "Use this pattern" };

async function showPageOf(slug: string) {
	const { default: DiscoverItemPage } = await import(
		"@/app/(landing)/discover/[slug]/page"
	);
	return render(await DiscoverItemPage({ params: Promise.resolve({ slug }) }));
}

afterEach(() => {
	session.status = "unauthenticated";
});

describe("the Discover page of a published pattern", () => {
	it.each([
		"unauthenticated",
		"loading",
		"authenticated",
	] as const)("lists every variable, with its meaning, while the session is %s", async (status) => {
		session.status = status;
		const scenario = await publishedScenario();

		await showPageOf(scenario.slug as string);

		expect(screen.getByRole("heading", VARIABLES_HEADING)).toBeVisible();
		expect(screen.getAllByText("system")).toHaveLength(2);
		for (const meaning of [
			MEANING.system,
			MEANING.owner,
			MEANING.scope,
			MEANING.nested,
			MEANING.dataset,
		]) {
			expect(screen.getByText(meaning)).toBeVisible();
		}
		expect(screen.getByText("owner")).toBeVisible();
		expect(screen.getByText("scope")).toBeVisible();
		expect(screen.getByText("dataset")).toBeVisible();
		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeVisible();
	});

	it("shows a default value only for the variable that has one", async () => {
		const scenario = await publishedScenario();

		await showPageOf(scenario.slug as string);

		expect(screen.getByText(DEFAULT_OWNER)).toBeVisible();
		expect(screen.getAllByText(DEFAULT_VALUE_LABEL)).toHaveLength(1);
	});

	it("does not list a named entry that is not a variable, or a plain line of context", async () => {
		const scenario = await publishedScenario();

		await showPageOf(scenario.slug as string);

		expect(screen.queryByText("window")).not.toBeInTheDocument();
		expect(screen.queryByText(MEANING.window)).not.toBeInTheDocument();
		expect(screen.queryByText("5 minutes")).not.toBeInTheDocument();
		expect(screen.queryByText("A plain note")).not.toBeInTheDocument();
	});

	it("lists them for an archived pattern", async () => {
		const scenario = await publishedScenario({ archived: true });

		await showPageOf(scenario.slug as string);

		expect(screen.getByRole("heading", VARIABLES_HEADING)).toBeVisible();
		expect(screen.getByText(MEANING.dataset)).toBeVisible();
	});

	it("lists those of the snapshot, not of the pattern case as it is now", async () => {
		const scenario = await publishedScenario();
		await prisma.assuranceElement.updateMany({
			where: { caseId: scenario.patternId },
			data: { context: [] },
		});

		await showPageOf(scenario.slug as string);

		expect(screen.getByRole("heading", VARIABLES_HEADING)).toBeVisible();
		expect(screen.getByText(MEANING.scope)).toBeVisible();
	});

	it("lists none from elements that were in the sandbox when the pattern was published", async () => {
		const scenario = await publishedScenario({
			prepare: async (owner, pattern) => {
				await addSandboxVariables(owner, pattern);
			},
		});

		await showPageOf(scenario.slug as string);

		expect(screen.getByRole("heading", VARIABLES_HEADING)).toBeVisible();
		expect(screen.queryByText("detached")).not.toBeInTheDocument();
		expect(screen.queryByText("beneath")).not.toBeInTheDocument();
	});

	it("shows no list, and no heading, for a pattern with no variables", async () => {
		const owner = await createTestUser();
		const pattern = await makePatternWithVariables(owner);
		await prisma.assuranceElement.updateMany({
			where: { caseId: pattern.id },
			data: { context: [] },
		});
		await createPublishedRow({
			slug: "plain-pattern",
			assuranceCaseId: pattern.id,
			content: await snapshotOf(owner, pattern.id),
		});

		await showPageOf("plain-pattern");

		expect(
			screen.queryByRole("heading", VARIABLES_HEADING)
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeVisible();
	});

	it("shows no list for a published ordinary case, though its snapshot has variables", async () => {
		const owner = await createTestUser();
		const pattern = await makePatternWithVariables(owner, { kind: "CASE" });
		await createPublishedRow({
			slug: "a-published-case",
			type: "ASSURANCE_CASE",
			assuranceCaseId: pattern.id,
			content: await snapshotOf(owner, pattern.id),
		});

		await showPageOf("a-published-case");

		expect(
			screen.queryByRole("heading", VARIABLES_HEADING)
		).not.toBeInTheDocument();
		expect(screen.queryByText(MEANING.system)).not.toBeInTheDocument();
		expect(screen.queryByText(DEFAULT_OWNER)).not.toBeInTheDocument();
	});

	it.each([
		["an empty object", {}],
		["an array", []],
		["text", "not a case"],
		["a tree that is text", { tree: "x" }],
		[
			"a tree of junk",
			{
				tree: {
					context: [null, 5, "plain", { id: 1 }, []],
					children: [null, "x", [], {}],
				},
			},
		],
	])("still shows the page, with no list, for a snapshot holding %s", async (_label, content) => {
		await createPublishedRow({ slug: "junk-pattern", content });

		await showPageOf("junk-pattern");

		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeVisible();
		expect(
			screen.queryByRole("heading", VARIABLES_HEADING)
		).not.toBeInTheDocument();
	});

	it("shows markup in a variable's name, meaning and value as text, and runs none of it", async () => {
		const tree = {
			id: "30000000-0000-4000-8000-000000000001",
			type: "GOAL",
			name: "G1",
			description: "The goal",
			inSandbox: false,
			assertionStatus: "ASSERTED",
			role: "TOP_LEVEL",
			context: [
				{
					id: ID.system,
					name: "<b>name</b>",
					text: "<img src=x onerror=alert(1)>",
					value: "<script>alert(2)</script>",
					variable: true,
				},
			],
			children: [],
		};
		await createPublishedRow({
			slug: "markup-pattern",
			content: { version: "1.1", case: { name: "n", description: "d" }, tree },
		});

		const { container } = await showPageOf("markup-pattern");

		expect(screen.getByText("<b>name</b>")).toBeVisible();
		expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
		expect(screen.getByText("<script>alert(2)</script>")).toBeVisible();
		const list = screen.getByRole("heading", VARIABLES_HEADING)
			.parentElement as HTMLElement;
		expect(list.querySelector("img")).toBeNull();
		expect(list.querySelector("script")).toBeNull();
		expect(list.querySelector("b")).toBeNull();
		expect(container.querySelector("script")).toBeNull();
	});

	it("shows a very long value and meaning without losing the rest of the page", async () => {
		const tree = {
			id: "30000000-0000-4000-8000-000000000001",
			type: "GOAL",
			name: "G1",
			description: "The goal",
			inSandbox: false,
			assertionStatus: "ASSERTED",
			role: "TOP_LEVEL",
			context: [
				{
					id: ID.system,
					name: "long",
					text: "m".repeat(50_000),
					value: "v".repeat(50_000),
					variable: true,
				},
			],
			children: [],
		};
		await createPublishedRow({
			slug: "long-pattern",
			content: { version: "1.1", case: { name: "n", description: "d" }, tree },
		});

		await showPageOf("long-pattern");

		const heading = screen.getByRole("heading", VARIABLES_HEADING);
		expect(heading).toBeVisible();
		expect(
			within(heading.parentElement as HTMLElement).getByText("long")
		).toBeVisible();
		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeVisible();
	});

	it("reads no session to list them", async () => {
		const scenario = await publishedScenario();
		readSession.mockClear();

		await showPageOf(scenario.slug as string);

		expect(readSession).not.toHaveBeenCalled();
	});
});
