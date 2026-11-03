import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import type { HistoryCommand } from "@/types/history";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	ASSISTANT_PATH,
	openWorld,
	routeFetchToElementHandlers,
	seedPlaceholderClaim,
	stored,
	type World,
} from "../utils/placeholder-kit";

/**
 * Undo and Redo of an edit made to a placeholder, replayed against the real
 * element route: Undo puts the marker and the earlier text back, and Redo
 * does not bring back a marker the edit had taken off.
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
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function recordedCommand(): HistoryCommand {
	const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
	if (!command) {
		throw new Error("Nothing was recorded for Undo");
	}
	return command;
}

/** Replays the recorded command backwards and forwards, reading the element after each step. */
async function undoThenRedo(elementId: string) {
	const command = recordedCommand();
	await applyUndo(command);
	const undone = await stored(elementId);
	await applyRedo(command);
	const redone = await stored(elementId);
	return { undone, redone };
}

describe("Undo and Redo of an edit applied by the Case Assistant to a placeholder in a case", () => {
	let world: World;

	beforeEach(async () => {
		world = await openWorld("CASE");
	});

	it("puts the marker, the hint and the empty text back on Undo, and leaves the marker off on Redo", async () => {
		const claim = await seedPlaceholderClaim(world, {
			placeholderHint: "Say what this claim asserts",
		});
		await ASSISTANT_PATH.write(world, claim.id, {
			description: "Operators are trained",
		});
		expect((await stored(claim.id)).isPlaceholder).toBe(false);

		const { undone, redone } = await undoThenRedo(claim.id);

		expect(undone).toMatchObject({
			isPlaceholder: true,
			description: "",
			placeholderHint: "Say what this claim asserts",
		});
		expect(redone).toMatchObject({
			isPlaceholder: false,
			description: "Operators are trained",
		});
	});

	it("puts the earlier text back on Undo when the placeholder already had some", async () => {
		const claim = await seedPlaceholderClaim(world, {
			description: "A first draft",
		});
		await ASSISTANT_PATH.write(world, claim.id, {
			description: "A second draft",
		});

		const { undone, redone } = await undoThenRedo(claim.id);

		expect(undone).toMatchObject({
			isPlaceholder: true,
			description: "A first draft",
		});
		expect(redone).toMatchObject({
			isPlaceholder: false,
			description: "A second draft",
		});
	});

	it("keeps the marker off through a second Undo and Redo", async () => {
		const claim = await seedPlaceholderClaim(world);
		await ASSISTANT_PATH.write(world, claim.id, { description: "Written" });
		const command = recordedCommand();

		await applyUndo(command);
		await applyRedo(command);
		await applyUndo(command);
		await applyRedo(command);

		expect(await stored(claim.id)).toMatchObject({
			isPlaceholder: false,
			description: "Written",
		});
	});

	it("does not mark an element that was not a placeholder, on Undo or on Redo", async () => {
		const claim = await world.seedClaim({
			name: "P1",
			description: "Already written",
		});
		await ASSISTANT_PATH.write(world, claim.id, { description: "Rewritten" });

		const { undone, redone } = await undoThenRedo(claim.id);

		expect(undone).toMatchObject({
			isPlaceholder: false,
			description: "Already written",
		});
		expect(redone).toMatchObject({
			isPlaceholder: false,
			description: "Rewritten",
		});
	});

	it("keeps a placeholder marked through an edit of its assumption alone, and through Undo and Redo", async () => {
		const claim = await seedPlaceholderClaim(world);
		await ASSISTANT_PATH.write(world, claim.id, {
			assumption: "Training is yearly",
		});
		expect((await stored(claim.id)).isPlaceholder).toBe(true);

		const { undone, redone } = await undoThenRedo(claim.id);

		expect(undone.isPlaceholder).toBe(true);
		expect(redone).toMatchObject({
			isPlaceholder: true,
			assumption: "Training is yearly",
		});
	});
});

describe("Undo and Redo of an edit applied by the Case Assistant to a placeholder in a pattern", () => {
	it("keeps the placeholder marked when the edit is applied, undone and redone", async () => {
		const world = await openWorld("PATTERN");
		const claim = await seedPlaceholderClaim(world, {
			description: "An example claim",
		});
		await ASSISTANT_PATH.write(world, claim.id, {
			description: "A reworded example claim",
		});
		expect((await stored(claim.id)).isPlaceholder).toBe(true);

		const { undone, redone } = await undoThenRedo(claim.id);

		expect(undone).toMatchObject({
			isPlaceholder: true,
			description: "An example claim",
		});
		expect(redone).toMatchObject({
			isPlaceholder: true,
			description: "A reworded example claim",
		});
	});
});

describe("Undo and Redo of switching a placeholder on or off in a pattern", () => {
	interface MarkerState {
		hint: string | null;
		marked: boolean;
	}

	function switchEntry(
		elementId: string,
		before: MarkerState,
		after: MarkerState
	): HistoryCommand {
		const snapshot = (state: MarkerState) => ({
			id: elementId,
			elementType: "property_claim",
			name: "P1",
			description: "An example claim",
			isPlaceholder: state.marked,
			placeholderHint: state.hint,
		});
		return {
			type: "update",
			elementId,
			elementType: "property_claim",
			before: snapshot(before),
			after: snapshot(after),
		};
	}

	it("switches the marker off and clears the hint on Undo of switching it on, and back on Redo", async () => {
		const world = await openWorld("PATTERN");
		const claim = await seedPlaceholderClaim(world, {
			description: "An example claim",
			placeholderHint: "Say what this claim asserts",
		});
		routeFetchToElementHandlers();
		const command = switchEntry(
			claim.id,
			{ marked: false, hint: null },
			{ marked: true, hint: "Say what this claim asserts" }
		);

		await applyUndo(command);
		const undone = await stored(claim.id);
		await applyRedo(command);
		const redone = await stored(claim.id);

		expect(undone.isPlaceholder).toBe(false);
		expect(undone.placeholderHint).toBeNull();
		expect(redone).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say what this claim asserts",
		});
	});

	it("switches the marker back on with its hint on Undo of switching it off, and off again on Redo", async () => {
		const world = await openWorld("PATTERN");
		const claim = await world.seedClaim({
			name: "P1",
			description: "An example claim",
		});
		routeFetchToElementHandlers();
		const command = switchEntry(
			claim.id,
			{ marked: true, hint: "Say what this claim asserts" },
			{ marked: false, hint: null }
		);

		await applyUndo(command);
		const undone = await stored(claim.id);
		await applyRedo(command);
		const redone = await stored(claim.id);

		expect(undone).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Say what this claim asserts",
		});
		expect(redone.isPlaceholder).toBe(false);
	});
});
