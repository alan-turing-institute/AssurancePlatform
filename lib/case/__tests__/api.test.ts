import { afterEach, describe, expect, it, vi } from "vitest";
import {
	attachCaseElement,
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	detachCaseElement,
	getNodeMutationErrorMessage,
	moveCaseElement,
	updateAssuranceCaseNode,
} from "../api";
import type { CreateNodePayload, ReactFlowNode } from "../types";

afterEach(() => {
	vi.unstubAllGlobals();
});

function stubFetch(respond: () => Promise<Response>) {
	const fetchMock = vi.fn(respond);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function replyWith(body: unknown, status: number) {
	return stubFetch(() =>
		Promise.resolve(new Response(JSON.stringify(body), { status }))
	);
}

function replyWithText(text: string, status: number) {
	return stubFetch(() => Promise.resolve(new Response(text, { status })));
}

function sentRequest(fetchMock: ReturnType<typeof stubFetch>) {
	const [url, init] = fetchMock.mock.calls[0] as unknown as [
		string,
		RequestInit,
	];
	return { url, init };
}

function parsedBody(init: RequestInit): unknown {
	return init.body === undefined ? undefined : JSON.parse(String(init.body));
}

const parentNode = {
	id: "flow-parent",
	type: "goal",
	position: { x: 0, y: 0 },
	data: {
		id: "parent-9",
		name: "Parent",
		type: "goal",
		goalId: "legacy-goal",
		strategyId: "legacy-strategy",
		propertyClaimId: "legacy-claim",
	},
} as ReactFlowNode;

const orphanNode = {
	id: "flow-orphan",
	type: "evidence",
	position: { x: 1, y: 1 },
	data: { id: "orphan-3", name: "Orphan", type: "evidence" },
} as ReactFlowNode;

const createPayload: CreateNodePayload = {
	assuranceCaseId: "case-1",
	description: "A description",
	name: "A name",
	parentId: "parent-1",
};

interface Operation {
	body?: unknown;
	fallback: string;
	method: string;
	name: string;
	networkResult: (thrown: Error) => unknown;
	okBody: unknown;
	run: () => Promise<unknown>;
	success: unknown;
	url: string;
}

const echoed = (thrown: Error) => ({ error: thrown });
const generic = () => ({ error: "An error occurred" });

const OPERATIONS: Operation[] = [
	{
		name: "create",
		run: () =>
			createAssuranceCaseNode("propertyclaims", createPayload, "token"),
		url: "/api/cases/case-1/elements",
		method: "POST",
		body: {
			description: "A description",
			name: "A name",
			parentId: "parent-1",
			type: "property_claim",
		},
		okBody: { id: "new-1", name: "A name" },
		success: { data: { id: "new-1", name: "A name" } },
		fallback: "Something went wrong 500",
		networkResult: echoed,
	},
	{
		name: "delete",
		run: () => deleteAssuranceCaseNode("goals", "g-5", "token"),
		url: "/api/elements/g-5",
		method: "DELETE",
		okBody: {},
		success: true,
		fallback: "Failed to delete node",
		networkResult: generic,
	},
	{
		name: "update",
		run: () =>
			updateAssuranceCaseNode("goals", 12, "token", { name: "Renamed" }),
		url: "/api/elements/12",
		method: "PUT",
		body: { name: "Renamed" },
		okBody: {},
		success: true,
		fallback: "Failed to update node",
		networkResult: generic,
	},
	{
		name: "detach",
		run: () => detachCaseElement(orphanNode, "evidence", "e-4", "token"),
		url: "/api/elements/e-4/detach?element_type=evidence",
		method: "POST",
		okBody: {},
		success: { detached: true },
		fallback: "Something went wrong 500",
		networkResult: echoed,
	},
	{
		name: "attach",
		run: () => attachCaseElement(orphanNode, "orphan-3", "token", parentNode),
		url: "/api/elements/orphan-3/attach",
		method: "POST",
		body: { parentId: "parent-9" },
		okBody: {},
		success: { attached: true },
		fallback: "Something went wrong 500",
		networkResult: echoed,
	},
	{
		name: "move",
		run: () => moveCaseElement("m-7", "parent-2"),
		url: "/api/elements/m-7/move",
		method: "POST",
		body: { parentId: "parent-2" },
		okBody: {},
		success: { moved: true },
		fallback: "Something went wrong 500",
		networkResult: echoed,
	},
];

describe("getNodeMutationErrorMessage", () => {
	it("gives the error text a refusal carries", () => {
		expect(
			getNodeMutationErrorMessage({ error: "No access" }, "Fallback")
		).toBe("No access");
	});

	it.each([
		["an empty error text", { error: "" }],
		["no error key", {} as unknown as { error: string }],
		["success", true],
		["false", false],
		["null", null as unknown as boolean],
	])("gives the fallback for %s", (_label, result) => {
		expect(getNodeMutationErrorMessage(result, "Fallback")).toBe("Fallback");
	});
});

describe("case element requests", () => {
	it.each(OPERATIONS)("$name sends the expected request", async (op) => {
		const fetchMock = replyWith(op.okBody, 200);
		await op.run();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const { url, init } = sentRequest(fetchMock);
		expect(url).toBe(op.url);
		expect(init.method).toBe(op.method);
		expect(init.headers).toStrictEqual({ "Content-Type": "application/json" });
		expect(parsedBody(init)).toStrictEqual(op.body);
	});

	it.each(OPERATIONS)("$name returns its success value", async (op) => {
		replyWith(op.okBody, 200);
		expect(await op.run()).toStrictEqual(op.success);
	});

	it.each(
		OPERATIONS
	)("$name returns the error text the server gave", async (op) => {
		replyWith({ error: "Not allowed" }, 403);
		expect(await op.run()).toStrictEqual({ error: "Not allowed" });
	});

	it.each(
		OPERATIONS.flatMap((op) =>
			[
				["an empty object", () => replyWith({}, 500)],
				["an empty error text", () => replyWith({ error: "" }, 500)],
				["text that is not JSON", () => replyWithText("<html>", 500)],
			].map(([label, reply]) => ({ op, label, reply }))
		)
	)("$op.name gives its fallback for a refusal with $label", async ({
		op,
		reply,
	}) => {
		(reply as () => void)();
		expect(await op.run()).toStrictEqual({ error: op.fallback });
	});

	it.each(OPERATIONS)("$name reports a network failure", async (op) => {
		const thrown = new Error("offline");
		stubFetch(() => Promise.reject(thrown));
		const result = await op.run();
		expect(result).toStrictEqual(op.networkResult(thrown));
		if (op.name === "create") {
			expect((result as { error: unknown }).error).toBe(thrown);
		}
	});
});

describe("createAssuranceCaseNode", () => {
	it("refuses without a case id and sends nothing", async () => {
		const fetchMock = replyWith({}, 200);
		const result = await createAssuranceCaseNode(
			"goals",
			{ description: "d", parentId: null },
			null
		);
		expect(result).toStrictEqual({ error: "Case ID is required" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("keeps the case id out of the body", async () => {
		const fetchMock = replyWith({ id: "x" }, 200);
		await createAssuranceCaseNode("goals", createPayload, null);
		const { init } = sentRequest(fetchMock);
		expect(parsedBody(init)).toStrictEqual({
			description: "A description",
			name: "A name",
			parentId: "parent-1",
			type: "goal",
		});
	});

	it("passes an unknown entity name through as the type", async () => {
		const fetchMock = replyWith({ id: "x" }, 200);
		await createAssuranceCaseNode("widgets", createPayload, null);
		const { init } = sentRequest(fetchMock);
		expect((parsedBody(init) as { type: string }).type).toBe("widgets");
	});

	it("returns everything the server sent back", async () => {
		replyWith({ id: "n-1", name: "Server name", extra: [1] }, 201);
		const result = await createAssuranceCaseNode("goals", createPayload, null);
		expect(result).toStrictEqual({
			data: { id: "n-1", name: "Server name", extra: [1] },
		});
	});
});

describe("attachCaseElement", () => {
	it("sends only the parent id, not the legacy parent fields", async () => {
		const fetchMock = replyWith({}, 200);
		await attachCaseElement(orphanNode, "orphan-3", null, parentNode);
		const { init } = sentRequest(fetchMock);
		expect(parsedBody(init)).toStrictEqual({ parentId: "parent-9" });
	});
});
