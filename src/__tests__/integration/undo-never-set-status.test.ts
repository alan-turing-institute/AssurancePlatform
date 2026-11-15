import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordedStates } from "@/lib/case/placeholders";
import {
	applyRedo,
	applyUndo,
	recordUpdate,
} from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	openWorld,
	putElement,
	routeFetchToElementHandlers,
	stored,
	type World,
} from "../utils/placeholder-kit";

/**
 * Undo and Redo of an edit from the element dialog that sets a status on a
 * claim which never had one, replayed against the real element route.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
	useHistoryStore.setState({
		caseId: null,
		undoStack: [],
		redoStack: [],
		isApplying: false,
	});
	routeFetchToElementHandlers();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Saves the fields as the dialog does, then records the edit as it does. */
async function saveFromDialog(
	world: World,
	elementId: string,
	fields: Record<string, unknown>
) {
	const row = await stored(elementId);
	const beforeData: Record<string, unknown> = {
		id: elementId,
		name: row.name,
		description: row.description,
		...(row.assertionStatus ? { assertionStatus: row.assertionStatus } : {}),
	};
	const response = await putElement(elementId, fields);
	if (response.status !== 200) {
		throw new Error(`The element route answered ${response.status}`);
	}
	const recorded = recordedStates(world.kind, beforeData, fields);
	recordUpdate(elementId, "property", recorded.before, recorded.after);
}

function recordedCommand() {
	const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
	if (!command) {
		throw new Error("Nothing was recorded for Undo");
	}
	return command;
}

describe("Undo and Redo of a status set on a claim that never had one", () => {
	let world: World;

	beforeEach(async () => {
		world = await openWorld("CASE");
	});

	it("puts the old text back with no status on Undo, and the new text and status on Redo", async () => {
		const claim = await world.seedClaim({
			name: "P1",
			description: "Old text",
		});
		expect((await stored(claim.id)).assertionStatus).toBeNull();
		await saveFromDialog(world, claim.id, {
			description: "New text",
			assertionStatus: "NEEDS_SUPPORT",
		});
		const command = recordedCommand();

		await applyUndo(command);
		expect(await stored(claim.id)).toMatchObject({
			description: "Old text",
			assertionStatus: null,
		});

		await applyRedo(command);
		expect(await stored(claim.id)).toMatchObject({
			description: "New text",
			assertionStatus: "NEEDS_SUPPORT",
		});
	});

	it("takes a status-only first save off again on Undo", async () => {
		const claim = await world.seedClaim({
			name: "P1",
			description: "Same text",
		});
		await saveFromDialog(world, claim.id, { assertionStatus: "ASSUMED" });
		const command = recordedCommand();

		await applyUndo(command);
		expect(await stored(claim.id)).toMatchObject({
			description: "Same text",
			assertionStatus: null,
		});

		await applyRedo(command);
		expect((await stored(claim.id)).assertionStatus).toBe("ASSUMED");
	});
});
