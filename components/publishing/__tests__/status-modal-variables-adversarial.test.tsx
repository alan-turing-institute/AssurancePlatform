import { configure, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCaseInformation } from "@/hooks/use-case-information";
import { useStatusModal } from "@/hooks/use-status-modal";
import { type DefinedTerm, termsInReach } from "@/lib/case/defined-terms";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import { StatusModal } from "../status-modal";
import { StatusModalWrapper } from "../status-modal-wrapper";

// The dialogs, editors and cards are slow to settle on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

/**
 * The publish dialog and variables that have no value: the count it shows,
 * what it counts, and that it holds back a case and never a pattern.
 */

vi.mock("@/hooks/use-case-information", () => ({
	useCaseInformation: vi.fn(),
}));

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

const CASE_ID = "case-1";
const SYS = "aaaaaaaaaa";
const OTHER = "bbbbbbbbbb";
const WIN = "cccccccccc";
const ONE_VARIABLE = /1 variable with no value/;
const TWO_VARIABLES = /2 variables with no value/;
const THREE_VARIABLES = /3 variables with no value/;
const TWO_ELEMENTS = /2 elements still to fill in/;
const ANY_VARIABLE = /variables? with no value/;
const ONE_ELEMENT = /1 element still to fill in/;
const ANY_ELEMENT = /still to fill in/;
const COMPLETE_INFORMATION = {
	description: "A worked example",
	authors: "Ada Lovelace",
	sector: "Healthcare",
	featureImageUrl: null,
};

type Entry = Extract<ContextEntry, object>;
const variable = (id: string, name: string, value?: string): Entry => ({
	id,
	name,
	text: "meaning",
	...(value === undefined ? {} : { value }),
	variable: true,
});
const ordinary = (id: string, name: string, value?: string): Entry => ({
	id,
	name,
	text: "meaning",
	...(value === undefined ? {} : { value }),
});
const ref = (name: string, id: string) => `{${name}#${id}}`;
function reach(...entries: Entry[]): DefinedTerm[] {
	return termsInReach([{ id: "g1", name: "G1", context: entries }]);
}

function card(
	id: number,
	data: Record<string, unknown> & { termsInReach?: DefinedTerm[] }
): Node {
	return {
		id: String(id),
		type: "property",
		position: { x: 0, y: 0 },
		data: { id, name: `P${id}`, description: "", ...data },
	};
}

function openWith(
	nodes: Node[],
	kind: "CASE" | "PATTERN",
	status: "DRAFT" | "PUBLISHED" = "DRAFT",
	hasChanges = true
): void {
	vi.mocked(useCaseInformation).mockReturnValue({
		forCaseId: CASE_ID,
		information: COMPLETE_INFORMATION,
		loading: false,
		saving: false,
		uploadingImage: false,
		save: vi.fn(),
		uploadFeatureImage: vi.fn(),
		removeFeatureImage: vi.fn(),
	});
	server.use(
		http.get(`/api/cases/${CASE_ID}/changes`, () =>
			HttpResponse.json({
				hasChanges,
				publishedAt: "2026-08-01T00:00:00.000Z",
				publishedId: "pub-1",
			})
		)
	);
	useStore.setState({
		assuranceCase: {
			id: CASE_ID,
			name: "Test",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			published: status === "PUBLISHED",
			publishStatus: status,
			kind,
		},
		nodes,
	});
	useStatusModal.getState().onOpen({
		caseId: CASE_ID,
		status,
		publishedAt: status === "PUBLISHED" ? "2026-08-01T00:00:00.000Z" : null,
	});
}

afterEach(() => {
	server.resetHandlers();
	vi.clearAllMocks();
	useStatusModal.getState().onClose();
	useStore.setState({ nodes: [] });
});

describe("the publish dialog of a case that mentions variables with no value", () => {
	const unset = reach(variable(SYS, "system"));

	it("says how many and offers no Publish button", async () => {
		openWith(
			[
				card(1, {
					description: `A ${ref("system", SYS)}`,
					termsInReach: unset,
				}),
				card(2, { description: "Plain", termsInReach: unset }),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_VARIABLE)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Publish" })
		).not.toBeInTheDocument();
	});

	it("counts a variable once however many cards mention it, and two variables as two", async () => {
		const both = reach(variable(SYS, "system"), variable(OTHER, "other"));
		openWith(
			[
				card(1, { description: ref("system", SYS), termsInReach: both }),
				card(2, { assumption: ref("system", SYS), termsInReach: both }),
				card(3, { justification: ref("other", OTHER), termsInReach: both }),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(await screen.findByText(TWO_VARIABLES)).toBeInTheDocument();
	});

	it("counts a mention in a card's context line", async () => {
		openWith(
			[
				card(1, {
					description: "Plain",
					context: [`see ${ref("system", SYS)}`],
					termsInReach: unset,
				}),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_VARIABLE)).toBeInTheDocument();
	});

	it("says both counts when elements are still to fill in as well", async () => {
		openWith(
			[
				card(1, { description: ref("system", SYS), termsInReach: unset }),
				card(2, { isPlaceholder: true }),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_VARIABLE)).toBeInTheDocument();
		expect(screen.getByText(ONE_ELEMENT)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Publish" })
		).not.toBeInTheDocument();
	});

	it.each([
		["a value", "AcmeBot"],
		["a value with spaces round it", "  AcmeBot  "],
	])("offers Publish once the variable has %s", async (_what, value) => {
		openWith(
			[
				card(1, {
					description: ref("system", SYS),
					termsInReach: reach(variable(SYS, "system", value)),
				}),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
		expect(screen.queryByText(ANY_VARIABLE)).not.toBeInTheDocument();
	});

	it.each([
		["spaces", "   "],
		["a newline", "\n"],
		["an empty string", ""],
	])("still counts a variable whose value is %s", async (_what, value) => {
		openWith(
			[
				card(1, {
					description: ref("system", SYS),
					termsInReach: reach(variable(SYS, "system", value)),
				}),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_VARIABLE)).toBeInTheDocument();
	});

	it("does not count a variable that is defined and never mentioned", async () => {
		openWith(
			[
				card(1, {
					description: "Plain",
					context: [variable(SYS, "system")],
					termsInReach: unset,
				}),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
		expect(screen.queryByText(ANY_VARIABLE)).not.toBeInTheDocument();
	});

	it("does not count an ordinary term with no value", async () => {
		openWith(
			[
				card(1, {
					description: ref("window", WIN),
					termsInReach: reach(ordinary(WIN, "window")),
				}),
			],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
	});

	it("does not count a card that cannot reach the variable", async () => {
		openWith(
			[card(1, { description: ref("system", SYS), termsInReach: [] })],
			"CASE"
		);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
	});

	it("does not hold back a pattern", async () => {
		openWith(
			[
				card(1, { description: ref("system", SYS), termsInReach: unset }),
				card(2, { isPlaceholder: true }),
			],
			"PATTERN"
		);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
		expect(screen.queryByText(ANY_VARIABLE)).not.toBeInTheDocument();
		expect(screen.queryByText(ANY_ELEMENT)).not.toBeInTheDocument();
	});

	it("shows the server's refusal when the canvas had not yet caught up", async () => {
		server.use(
			http.post(`/api/cases/${CASE_ID}/publish`, () =>
				HttpResponse.json(
					{
						error: "1 element still to fill in; 2 variables with no value",
						code: "VALIDATION",
					},
					{ status: 400 }
				)
			)
		);
		openWith([card(1, { description: "Plain", termsInReach: unset })], "CASE");
		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(await screen.findByRole("button", { name: "Publish" }));

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "1 element still to fill in; 2 variables with no value",
				})
			)
		);
		expect(useStore.getState().assuranceCase?.published).toBe(false);
	});
});

describe("the dialog of a published case with a variable that has no value", () => {
	const unset = reach(variable(SYS, "system"));
	const mention = () =>
		card(1, { description: ref("system", SYS), termsInReach: unset });

	it("offers no Update Published button while the case has changes, and still offers Unpublish", async () => {
		openWith([mention()], "CASE", "PUBLISHED", true);

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_VARIABLE)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Update Published" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Unpublish" })
		).toBeInTheDocument();
	});

	it("offers Update Published once the variable has a value", async () => {
		openWith(
			[
				card(1, {
					description: ref("system", SYS),
					termsInReach: reach(variable(SYS, "system", "AcmeBot")),
				}),
			],
			"CASE",
			"PUBLISHED",
			true
		);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Update Published" })
		).toBeInTheDocument();
	});

	it("does not hold back a published pattern", async () => {
		openWith([mention()], "PATTERN", "PUBLISHED", true);

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Update Published" })
		).toBeInTheDocument();
		expect(screen.queryByText(ANY_VARIABLE)).not.toBeInTheDocument();
	});
});

describe("the dialog on its own", () => {
	function renderModal(
		props: Partial<React.ComponentProps<typeof StatusModal>>
	) {
		vi.mocked(useCaseInformation).mockReturnValue({
			forCaseId: CASE_ID,
			information: COMPLETE_INFORMATION,
			loading: false,
			saving: false,
			uploadingImage: false,
			save: vi.fn(),
			uploadFeatureImage: vi.fn(),
			removeFeatureImage: vi.fn(),
		});
		render(
			<StatusModal
				caseId={CASE_ID}
				onOpenChange={vi.fn()}
				onPublish={vi.fn()}
				open={true}
				status="DRAFT"
				{...props}
			/>
		);
	}

	it("says one variable in the singular and several in the plural", () => {
		renderModal({ unsetVariableCount: 1 });
		expect(screen.getByText(ONE_VARIABLE)).toBeInTheDocument();
	});

	it("says only the variables when no element is left to fill in, and only the elements when no variable is", () => {
		renderModal({ unsetVariableCount: 3 });
		expect(screen.getByText(THREE_VARIABLES)).toBeInTheDocument();
		expect(screen.queryByText(ANY_ELEMENT)).not.toBeInTheDocument();
	});

	it("says nothing about variables when there are none, and offers Publish", () => {
		renderModal({ unsetVariableCount: 0 });
		expect(screen.queryByText(ANY_VARIABLE)).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
	});

	it("says nothing about variables when none is given, as before", () => {
		renderModal({ placeholderCount: 2 });
		expect(screen.queryByText(ANY_VARIABLE)).not.toBeInTheDocument();
		expect(screen.getByText(TWO_ELEMENTS)).toBeInTheDocument();
	});
});
