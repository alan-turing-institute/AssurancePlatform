import { act } from "@testing-library/react";
import { vi } from "vitest";
import { resetCaseEventStreams } from "@/hooks/use-case-events";
import {
	useEdgeAppearance,
	useNodeAppearance,
} from "@/hooks/use-element-appearance";
import { useElementBadgeSlot } from "@/hooks/use-element-badge-slot";
import { useEnabledPluginIds } from "@/hooks/use-plugin-enablement";
import type {
	HealthLiveEvidenceNode,
	HealthStatus,
} from "@/lib/plugins/health/health-types";
import { resetLiveNodesForTests } from "@/lib/plugins/health/live-evidence-nodes";
import { registerHealthPlugin } from "@/lib/plugins/health/register";
import {
	casePanelSlot,
	elementAppearanceSlot,
	elementBadgeSlot,
	elementPanelSlot,
} from "@/lib/plugins/slots";
import useStore from "@/store/store";

/**
 * A stand-in canvas for the tests of the live evidence node's look: a case
 * whose list of live nodes and claim statuses the test controls, a stand-in
 * for the browser's event stream, and the health plugin registered the way the
 * app registers it. Mock `@/hooks/use-plugin-enablement` in the test file
 * (`vi.mock(..., () => ({ useEnabledPluginIds: vi.fn() }))`) and call
 * `enablePlugins` to say which plugins are on.
 */

export const CASE_ID = "case-1";
export const CLAIM_ID = "claim-42";
export const NODE_ID = "node-1";

export class FakeEventSource {
	static all: FakeEventSource[] = [];
	closed = false;
	onerror: (() => void) | null = null;
	onopen: (() => void) | null = null;
	readonly url: string;
	private readonly listeners = new Map<string, ((e: MessageEvent) => void)[]>();

	constructor(url: string) {
		this.url = url;
		FakeEventSource.all.push(this);
	}

	addEventListener(type: string, listener: (e: MessageEvent) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	close() {
		this.closed = true;
	}

	emit(type: string) {
		const body = { type, caseId: CASE_ID, payload: {}, timestamp: "now" };
		for (const listener of this.listeners.get(type) ?? []) {
			listener({ data: JSON.stringify(body) } as MessageEvent);
		}
	}
}

export interface CanvasWorld {
	/** The answer to the list of live nodes. */
	list: HealthLiveEvidenceNode[];
	/** Makes the list request fail. */
	listFails: boolean;
	/** When set, the list request waits until this promise settles. */
	listGate: Promise<void> | null;
	/** Every URL requested, in order. */
	requests: string[];
	/** Each claim's status as its own health route serves it. */
	statuses: Record<string, HealthStatus | null>;
}

export function listRequests(world: CanvasWorld) {
	return world.requests.filter((url) => url.endsWith("/health/evidence-nodes"));
}

const CLAIM_STATUS_URL = /^\/api\/elements\/([^/]+)\/health$/;

function json(body: unknown) {
	return Response.json(body);
}

/** Registers the health plugin afresh, with every slot empty before it. */
export function registerHealthOnly() {
	casePanelSlot.resetForTests();
	elementAppearanceSlot.resetForTests();
	elementBadgeSlot.resetForTests();
	elementPanelSlot.resetForTests();
	registerHealthPlugin();
}

/** Says which plugins are on for the viewer, and whether that is still loading. */
export function enablePlugins(ids: string[], loading = false) {
	vi.mocked(useEnabledPluginIds).mockReturnValue({
		enabledPluginIds: new Set(ids),
		loading,
	});
}

/** Puts the world in place: requests, the event stream and the canvas's case. */
export function installCanvasWorld(
	options: { caseId?: string } = {}
): CanvasWorld {
	const world: CanvasWorld = {
		list: [],
		listFails: false,
		listGate: null,
		requests: [],
		statuses: {},
	};
	FakeEventSource.all = [];
	vi.stubGlobal("EventSource", FakeEventSource);
	vi.stubGlobal(
		"fetch",
		vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			world.requests.push(url);
			if (url.endsWith("/health/evidence-nodes")) {
				const answer = () =>
					world.listFails
						? new Response("failed", { status: 500 })
						: json(world.list);
				return world.listGate
					? world.listGate.then(answer)
					: Promise.resolve(answer());
			}
			const claim = CLAIM_STATUS_URL.exec(url);
			if (claim?.[1]) {
				return Promise.resolve(
					json({ status: world.statuses[claim[1]] ?? null })
				);
			}
			return Promise.resolve(new Response("not found", { status: 404 }));
		})
	);
	useStore.setState({
		assuranceCase: { id: options.caseId ?? CASE_ID } as never,
		readOnlyCanvas: false,
	});
	return world;
}

export function removeCanvasWorld() {
	resetLiveNodesForTests();
	resetCaseEventStreams();
	vi.unstubAllGlobals();
	useStore.setState({ assuranceCase: null, nodes: [], edges: [] });
}

/** Lets every pending request and re-render finish. */
export async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

/** Delivers an event of `type` to every open event stream and lets the canvas react. */
export async function emit(type: string) {
	act(() => {
		for (const source of FakeEventSource.all.filter((s) => !s.closed)) {
			source.emit(type);
		}
	});
	await settle();
}

/**
 * What the canvas asks about one live-node candidate: how the node is drawn,
 * how the line from `claimId` to it is drawn, and the slot's badge on it.
 */
export function NodeProbe({
	claimId = CLAIM_ID,
	nodeId = NODE_ID,
}: {
	claimId?: string;
	nodeId?: string;
}) {
	const node = useNodeAppearance(nodeId, "evidence");
	const edge = useEdgeAppearance(claimId, nodeId);
	const badge = useElementBadgeSlot({
		caseId: CASE_ID,
		elementId: nodeId,
		elementType: "evidence",
	});
	return (
		<div>
			<output data-testid="node-look">{JSON.stringify(node)}</output>
			<output data-testid="edge-look">{JSON.stringify(edge)}</output>
			{badge}
		</div>
	);
}

export interface Look {
	faded: boolean;
	tone: "caution" | "negative" | "neutral" | "positive";
}
