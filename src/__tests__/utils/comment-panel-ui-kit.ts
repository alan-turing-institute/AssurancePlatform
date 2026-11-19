import type { Node } from "reactflow";
import { vi } from "vitest";
import type { CommentResponse } from "@/lib/services/comment-service";
import useStore from "@/store/store";

/** The signed-in person's name in the shared next-auth mock. */
export const SIGNED_IN_AS = "Test User";
export const SOMEONE_ELSE = "Someone Else";
const ELEMENT_DATA_ID = 7;

const RESOLVED_AT = "2026-11-02T09:00:00.000Z";

const PANEL_NODE: Node = {
	id: "goal-7",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: ELEMENT_DATA_ID, name: "G1" },
};

export function makeComment(
	n: number,
	author: string,
	overrides: Partial<CommentResponse> = {}
): CommentResponse {
	return {
		id: `c${n}`,
		author,
		content: `Comment number ${n}`,
		createdAt: new Date(Date.UTC(2026, 10, 1, 10, n)).toISOString(),
		resolved: false,
		replies: [],
		...overrides,
	};
}

/** A comment someone resolved, so the panel offers Unresolve on it. */
export function makeResolvedComment(
	n: number,
	author: string
): CommentResponse {
	return makeComment(n, author, {
		resolved: true,
		resolvedBy: SOMEONE_ELSE,
		resolvedAt: RESOLVED_AT,
	});
}

/** Loads a case into the store; `null` leaves nothing loaded. */
export function seedCase(permissions: string | string[] | null): void {
	useStore.setState({
		nodeComments: [],
		assuranceCase:
			permissions === null
				? null
				: {
						id: "case-1",
						name: "Test Case",
						type: "assurance_case",
						permissions,
						createdDate: "2026-11-01T09:00:00.000Z",
						comments: [],
					},
	});
}

/** Changes the loaded case's permission while a panel is already mounted. */
export function changePermissions(permissions: string): void {
	useStore.setState((state) => ({
		assuranceCase: state.assuranceCase && {
			...state.assuranceCase,
			permissions,
		},
	}));
}

export function openPanel(): void {
	useStore.setState({ commentsSheetOpen: true, commentsSheetNode: PANEL_NODE });
}

export function resetPanelStore(): void {
	useStore.setState({
		assuranceCase: null,
		nodeComments: [],
		commentsSheetOpen: false,
		commentsSheetNode: null,
	});
}

export interface CommentApiStub {
	restore: () => void;
	/** Every request other than the panel's own comment load, in order. */
	writes: Array<{ body: Record<string, unknown>; method: string; url: string }>;
}

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function replyToWrite(method: string, body: Record<string, unknown>): unknown {
	if (method === "POST") {
		return makeComment(99, SIGNED_IN_AS, { content: String(body.content) });
	}
	const resolved = body.resolved === true;
	return {
		resolved,
		resolvedBy: resolved ? SIGNED_IN_AS : null,
		resolvedAt: resolved ? RESOLVED_AT : null,
	};
}

/** Serves the element's comments on load and records the writes that follow. */
export function stubCommentsApi(existing: CommentResponse[]): CommentApiStub {
	const writes: CommentApiStub["writes"] = [];
	const spy = vi
		.spyOn(globalThis, "fetch")
		.mockImplementation((input, init) => {
			const method = init?.method ?? "GET";
			if (method === "GET") {
				return Promise.resolve(jsonResponse(existing));
			}
			const body = JSON.parse(String(init?.body ?? "{}"));
			writes.push({ method, url: String(input), body });
			return Promise.resolve(jsonResponse(replyToWrite(method, body)));
		});
	return { writes, restore: () => spy.mockRestore() };
}
