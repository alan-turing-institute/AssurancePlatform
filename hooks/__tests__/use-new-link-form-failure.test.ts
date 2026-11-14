import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import { useNewLinkForm } from "../use-new-link-form";

const CLAIM_NODE: Node = {
	id: "1",
	type: "property",
	position: { x: 0, y: 0 },
	data: { id: "11111111-1111-4111-8111-111111111111" },
};
const STRATEGY_NODE: Node = {
	id: "2",
	type: "strategy",
	position: { x: 0, y: 0 },
	data: { id: "22222222-2222-4222-8222-222222222222" },
};
const GOAL_NODE: Node = {
	id: "3",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: "33333333-3333-4333-8333-333333333333" },
};

const CASE = {
	id: "case-1",
	goals: [
		{
			id: GOAL_NODE.data.id,
			propertyClaims: [
				{ id: CLAIM_NODE.data.id, propertyClaims: [], evidence: [] },
			],
			strategies: [],
		},
	],
} as unknown as AssuranceCaseResponse;

interface Kind {
	created: Record<string, unknown>;
	linkType: string;
	node: Node;
}

/** Each way a user adds something from the dialog, with a response the server gives on success. */
const KINDS: Kind[] = [
	{
		linkType: "claim",
		node: CLAIM_NODE,
		created: {
			id: "new-claim",
			name: "P1.1",
			propertyClaimId: CLAIM_NODE.data.id,
		},
	},
	{
		linkType: "claim",
		node: GOAL_NODE,
		created: { id: "new-claim", name: "P1" },
	},
	{
		linkType: "claim",
		node: STRATEGY_NODE,
		created: { id: "new-claim", name: "P1", strategyId: STRATEGY_NODE.data.id },
	},
	{
		linkType: "strategy",
		node: GOAL_NODE,
		created: { id: "new-strategy", name: "S1" },
	},
	{
		linkType: "defeater",
		node: CLAIM_NODE,
		created: {
			id: "new-defeater",
			name: "CP1",
			propertyClaimId: CLAIM_NODE.data.id,
		},
	},
	{
		linkType: "evidence",
		node: CLAIM_NODE,
		created: {
			id: "new-evidence",
			name: "E1",
			propertyClaimId: [CLAIM_NODE.data.id],
		},
	},
];

const FAILURES: [label: string, respond: () => Response][] = [
	[
		"a server error with a message",
		() => HttpResponse.json({ error: "Server said no" }, { status: 500 }),
	],
	[
		"a validation error",
		() => HttpResponse.json({ error: "Not valid" }, { status: 400 }),
	],
	["an error with no body", () => new HttpResponse(null, { status: 502 })],
	[
		"an error with a body that is not JSON",
		() => new HttpResponse("oops", { status: 500 }),
	],
	["a network failure", () => HttpResponse.error()],
];

function actions() {
	return {
		setSelectedLink: vi.fn(),
		setLinkToCreate: vi.fn(),
		handleClose: vi.fn(),
	};
}

function setup(kind: Kind, given = actions()) {
	const rendered = renderHook(() =>
		useNewLinkForm({
			node: kind.node,
			linkType: kind.linkType,
			actions: given,
			setUnresolvedChanges: vi.fn(),
		})
	);
	return { ...rendered, actions: given };
}

type Rendered = ReturnType<typeof setup>;

/** Types the description and presses Add, without waiting for the answer. */
function press(result: Rendered["result"], description: string) {
	act(() => {
		result.current.form.setValue("description", description);
	});
	act(() => {
		result.current.onSubmit(result.current.form.getValues());
	});
}

function elementsRoute(respond: () => Response | Promise<Response>) {
	server.use(http.post("/api/cases/:caseId/elements", () => respond()));
}

const destructiveToasts = () =>
	vi
		.mocked(toast)
		.mock.calls.filter(([options]) => options?.variant === "destructive");

beforeEach(() => {
	useStore.setState({ assuranceCase: CASE });
	vi.mocked(toast).mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
	useStore.setState({ assuranceCase: null });
});

describe("useNewLinkForm — when creation fails", () => {
	for (const kind of KINDS) {
		describe(`adding a ${kind.linkType} from a ${kind.node.type} node`, () => {
			it.each(
				FAILURES
			)("stops loading, keeps the dialog open and keeps the text after %s", async (_label, respond) => {
				elementsRoute(respond);
				const { result, actions: given } = setup(kind);

				press(result, "What the user typed");
				await waitFor(() => expect(result.current.loading).toBe(false));

				expect(destructiveToasts()).toHaveLength(1);
				expect(given.handleClose).not.toHaveBeenCalled();
				expect(given.setSelectedLink).not.toHaveBeenCalled();
				expect(given.setLinkToCreate).not.toHaveBeenCalled();
				expect(result.current.form.getValues("description")).toBe(
					"What the user typed"
				);
			});

			it("shows loading while the request is out and clears it when the answer is an error", async () => {
				let release: () => void = () => undefined;
				const gate = new Promise<void>((resolve) => {
					release = resolve;
				});
				elementsRoute(async () => {
					await gate;
					return HttpResponse.json({ error: "Late failure" }, { status: 500 });
				});
				const { result } = setup(kind);

				press(result, "Slow one");
				await waitFor(() => expect(result.current.loading).toBe(true));
				release();
				await waitFor(() => expect(result.current.loading).toBe(false));
			});

			it("lets the user try again, and a second attempt that succeeds closes the dialog", async () => {
				let calls = 0;
				elementsRoute(() => {
					calls += 1;
					return calls === 1
						? HttpResponse.json(
								{ error: "First attempt fails" },
								{ status: 500 }
							)
						: HttpResponse.json(kind.created, { status: 201 });
				});
				const { result, actions: given } = setup(kind);

				press(result, "Try twice");
				await waitFor(() => expect(result.current.loading).toBe(false));
				expect(given.handleClose).not.toHaveBeenCalled();

				press(result, "Try twice");
				await waitFor(() => expect(given.handleClose).toHaveBeenCalledTimes(1));
				await waitFor(() => expect(result.current.loading).toBe(false));

				expect(calls).toBe(2);
				expect(destructiveToasts()).toHaveLength(1);
			});

			it("clears loading after every one of several failures in a row", async () => {
				elementsRoute(() =>
					HttpResponse.json({ error: "Always fails" }, { status: 500 })
				);
				const { result } = setup(kind);

				for (let attempt = 0; attempt < 3; attempt++) {
					press(result, "Again");
					await waitFor(() =>
						expect(destructiveToasts()).toHaveLength(attempt + 1)
					);
					await waitFor(() => expect(result.current.loading).toBe(false));
				}
			});

			it("clears loading when there is no case to add to", async () => {
				useStore.setState({ assuranceCase: null });
				const { result, actions: given } = setup(kind);

				press(result, "Nowhere to go");
				await waitFor(() => expect(result.current.loading).toBe(false));

				expect(given.handleClose).not.toHaveBeenCalled();
			});
		});
	}
});

describe("useNewLinkForm — the message for a claim that failed", () => {
	it("tells the user a claim could not be created", async () => {
		elementsRoute(() =>
			HttpResponse.json({ error: "Server said no" }, { status: 500 })
		);
		const { result } = setup(KINDS[0] as Kind);

		press(result, "A claim");
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "destructive",
				title: "Error",
				description: "Failed to create claim",
			})
		);
	});
});

describe("useNewLinkForm — evidence that is created but cannot be placed", () => {
	it("clears loading when the parent claim is not in the case", async () => {
		elementsRoute(() =>
			HttpResponse.json(
				{
					id: "new-evidence",
					name: "E1",
					propertyClaimId: ["not-in-this-case"],
				},
				{ status: 201 }
			)
		);
		const kind = KINDS.find((k) => k.linkType === "evidence") as Kind;
		const { result, actions: given } = setup(kind);

		press(result, "Orphan evidence");
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "destructive",
				description: "Could not find the parent property claim.",
			})
		);
		expect(given.handleClose).not.toHaveBeenCalled();
	});
});
