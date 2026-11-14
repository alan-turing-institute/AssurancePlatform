import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseEventsOptions } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type { HealthEvidenceLogItem, HealthThinnedRun } from "../health-types";
import { item, status } from "./health-test-data";

// The times in a gap line are the viewer's local time; fix the zone so the
// expected text is exact. This runs before the modules that format dates load.
vi.hoisted(() => {
	process.env.TZ = "UTC";
});

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};
const EVIDENCE_URL = `/api/machine/health/elements/${CLAIM_CONTEXT.elementId}/evidence`;
const STATUS_URL = `/api/elements/${CLAIM_CONTEXT.elementId}/health`;

let capturedOptions: UseCaseEventsOptions[] = [];

beforeEach(() => {
	capturedOptions = [];
	vi.mocked(useCaseEvents).mockImplementation((options) => {
		capturedOptions.push(options);
		return {
			status: "connected",
			isConnected: true,
			lastEvent: null,
			reconnect: vi.fn(),
			disconnect: vi.fn(),
		};
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

const note = (over: Partial<HealthThinnedRun> = {}): HealthThinnedRun => ({
	removed_count: 1437,
	first_removed_at: "2026-10-14T10:00:00.000Z",
	first_removed_sequence: 100,
	last_removed_at: "2026-10-14T11:00:00.000Z",
	last_removed_sequence: 1536,
	rule_version: 1,
	thinned_at: "2026-10-16T03:47:00.000Z",
	...over,
});

function logItem(
	comment: string,
	sequence: number,
	thinned: HealthThinnedRun | null
): HealthEvidenceLogItem {
	return {
		...item({ id: `row-${comment}`, chain_sequence: sequence }, { comment }),
		thinned_before: thinned,
	};
}

function mockPages(pages: [HealthEvidenceLogItem[], number | null][]) {
	const [first, ...rest] = pages;
	server.use(
		http.get(STATUS_URL, () => HttpResponse.json({ status: status() })),
		http.get(EVIDENCE_URL, ({ request }) => {
			const before = new URL(request.url).searchParams.get("before");
			const page = before ? rest.shift() : first;
			return HttpResponse.json({
				evidence: page?.[0] ?? [],
				next_before: page?.[1] ?? null,
			});
		})
	);
}

const ENTRY = "health-evidence-entry";
const LABEL = /(newest|middle|oldest|page-(?:one|two)-[ab])/;
const LINE = "health-evidence-thinned";

/** What the list shows from top to bottom: each entry by its comment, each gap line by its text. */
function listing(): string[] {
	return [
		...document.querySelectorAll(
			`[data-testid="${ENTRY}"], [data-testid="${LINE}"]`
		),
	].map((element) =>
		element.getAttribute("data-testid") === LINE
			? `LINE: ${element.textContent}`
			: (element.textContent?.match(LABEL)?.[1] ?? "entry")
	);
}

describe("HealthPanel — a gap where passing results were removed", () => {
	it("shows one line for each gap, between the kept records either side, with the count and the times", async () => {
		mockPages([
			[
				[
					logItem("newest", 30, note()),
					logItem("middle", 20, null),
					logItem(
						"oldest",
						10,
						note({
							removed_count: 1,
							first_removed_at: "2026-10-13T23:30:00.000Z",
							last_removed_at: "2026-10-13T23:30:00.000Z",
						})
					),
				],
				null,
			],
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("newest");

		expect(screen.getAllByTestId(LINE)).toHaveLength(2);
		expect(listing()).toEqual([
			"newest",
			"LINE: 1,437 identical passing results from 10:00 to 11:00 on 14 Oct are not kept.",
			"middle",
			"oldest",
			"LINE: 1 identical passing result at 23:30 on 13 Oct is not kept.",
		]);
	});

	it("shows no line anywhere when no record has a note", async () => {
		mockPages([
			[[logItem("newest", 30, null), logItem("oldest", 10, null)], null],
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("newest");

		expect(screen.queryByTestId(LINE)).toBeNull();
		expect(listing()).toEqual(["newest", "oldest"]);
	});

	it("names both days when the removed stretch ran across midnight, and groups big counts", async () => {
		mockPages([
			[
				[
					logItem(
						"newest",
						30,
						note({
							removed_count: 1_437_000,
							first_removed_at: "2026-10-13T23:00:00.000Z",
							last_removed_at: "2026-10-14T01:00:00.000Z",
						})
					),
				],
				null,
			],
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("newest");

		expect(screen.getByTestId(LINE)).toHaveTextContent(
			"1,437,000 identical passing results from 23:00 on 13 Oct to 01:00 on 14 Oct are not kept."
		);
	});

	it("keeps a record's line with it when the next older page is loaded, and shows that page's own gaps in order", async () => {
		mockPages([
			[
				[
					logItem("page-one-a", 40, note({ removed_count: 12 })),
					logItem(
						"page-one-b",
						30,
						note({
							removed_count: 5,
							first_removed_at: "2026-10-14T08:00:00.000Z",
							last_removed_at: "2026-10-14T08:20:00.000Z",
						})
					),
				],
				30,
			],
			[
				[
					logItem("page-two-a", 20, null),
					logItem(
						"page-two-b",
						10,
						note({
							removed_count: 7,
							first_removed_at: "2026-10-13T08:00:00.000Z",
							last_removed_at: "2026-10-13T09:00:00.000Z",
						})
					),
				],
				null,
			],
		]);
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("page-one-a");

		// The newest page ends on a gap: the line is there before anything older.
		expect(listing()).toEqual([
			"page-one-a",
			"LINE: 12 identical passing results from 10:00 to 11:00 on 14 Oct are not kept.",
			"page-one-b",
			"LINE: 5 identical passing results from 08:00 to 08:20 on 14 Oct are not kept.",
		]);

		await user.click(screen.getByRole("button", { name: "Load older" }));
		await screen.findByText("page-two-a");

		expect(listing()).toEqual([
			"page-one-a",
			"LINE: 12 identical passing results from 10:00 to 11:00 on 14 Oct are not kept.",
			"page-one-b",
			"LINE: 5 identical passing results from 08:00 to 08:20 on 14 Oct are not kept.",
			"page-two-a",
			"page-two-b",
			"LINE: 7 identical passing results from 08:00 to 09:00 on 13 Oct are not kept.",
		]);
	});

	it("does not break the list for a note with times it cannot read", async () => {
		mockPages([
			[
				[
					logItem(
						"newest",
						30,
						note({ first_removed_at: "garbage", last_removed_at: "garbage" })
					),
					logItem("oldest", 10, null),
				],
				null,
			],
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("newest");

		expect(screen.getByTestId(LINE)).toHaveTextContent(
			"1,437 identical passing results are not kept."
		);
		expect(listing()).toHaveLength(3);
	});

	it("is not shown for an item that the server sent without the field", async () => {
		const bare = item(
			{ id: "row-bare", chain_sequence: 5 },
			{ comment: "newest" }
		);
		Reflect.deleteProperty(bare, "thinned_before");
		mockPages([[[bare], null]]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("newest");

		expect(screen.queryByTestId(LINE)).toBeNull();
		expect(capturedOptions.length).toBeGreaterThan(0);
	});
});

describe("the words of a gap, in the viewer's time zone", () => {
	const wordsIn = async (zone: string, run: HealthThinnedRun) => {
		const before = process.env.TZ;
		process.env.TZ = zone;
		vi.resetModules();
		try {
			const { describeThinnedRun } = await import("../health-format");
			return describeThinnedRun(run);
		} finally {
			process.env.TZ = before;
			vi.resetModules();
		}
	};

	it.each([
		[
			"UTC",
			"1,437 identical passing results from 10:00 to 11:00 on 14 Oct are not kept.",
		],
		[
			"America/New_York",
			"1,437 identical passing results from 06:00 to 07:00 on 14 Oct are not kept.",
		],
		[
			"Pacific/Auckland",
			"1,437 identical passing results from 23:00 on 14 Oct to 00:00 on 15 Oct are not kept.",
		],
	])("reads the same stretch in %s", async (zone, expected) => {
		expect(await wordsIn(zone, note())).toBe(expected);
	});
});
