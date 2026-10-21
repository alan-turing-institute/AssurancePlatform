"use client";

import { useCallback, useRef } from "react";
import {
	fetchShowUnsupportedMarkers,
	saveShowUnsupportedMarkers,
} from "@/actions/unsupported-markers";
import { toast } from "@/lib/toast";

interface UnsupportedMarkerSwitch {
	/** What the switch shows. Off while the setting has not loaded. */
	checked: boolean;
	/** True until the setting has loaded, so a press cannot save over a value that is not known. */
	disabled: boolean;
	onCheckedChange: (next: boolean) => void;
}

/** A press whose save has not come back yet. */
interface PendingPress {
	value: boolean;
}

/** What the switch remembers between presses. */
interface SwitchState {
	/** True once a save has failed, until the stored value has been read back. */
	doubtful: boolean;
	/** Saves, and reads of the stored value, that have not come back yet. */
	inFlight: number;
	/** Presses whose save has not come back and that no later stored press has settled. */
	pending: PendingPress[];
	/** How many presses have been made, so a read can tell a press came after it started. */
	pressCount: number;
	/** What the switch last showed. */
	shown: boolean | null;
	/** The last value known to be stored on the account. */
	stored: boolean | null;
}

async function trySave(next: boolean): Promise<boolean | null> {
	try {
		return await saveShowUnsupportedMarkers(next);
	} catch {
		return null;
	}
}

async function tryRead(): Promise<boolean | null> {
	try {
		return await fetchShowUnsupportedMarkers();
	} catch {
		return null;
	}
}

/**
 * Takes one save's answer into account. A save that came back with a value
 * is stored, and settles every earlier press with it. A save that failed
 * leaves the account in doubt, because the server may have stored the value
 * and lost the reply, and drops that press from the list of choices waiting.
 */
function recordAnswer(
	state: SwitchState,
	press: PendingPress,
	saved: boolean | null
): void {
	state.inFlight -= 1;
	const position = state.pending.indexOf(press);
	if (saved === null) {
		state.doubtful = true;
		if (position !== -1) {
			state.pending.splice(position, 1);
		}
	} else if (position !== -1) {
		state.stored = saved;
		state.pending = state.pending.slice(position + 1);
	}
}

/**
 * Once nothing is in flight and a save has failed, reads the stored value from
 * the account and keeps it as the known stored value. A read that cannot be
 * made leaves the last known value. A read is also dropped when a press was
 * made after it started, because that press's own answer is newer.
 */
async function readBackWhenQuiet(state: SwitchState): Promise<void> {
	while (state.inFlight === 0 && state.doubtful) {
		state.doubtful = false;
		state.inFlight += 1;
		const pressesBefore = state.pressCount;
		const read = await tryRead();
		state.inFlight -= 1;
		if (read !== null && state.pressCount === pressesBefore) {
			state.stored = read;
		}
	}
}

/**
 * The on/off switch for the unsupported markers, shared by the case toolbar
 * and the Settings page. `value` is the setting as the caller holds it, with
 * `null` for "not loaded yet", and `setValue` replaces it.
 *
 * A press changes the held value first, so the switch and the diagram answer
 * at once, then saves it to the account. Presses are ordered by when they
 * were made, and the switch always shows the latest press whose save has not
 * failed, or the last value known to be stored when every save has failed.
 * So a failed save puts back the choice beneath it, with a message, and
 * does nothing when a later press is still waiting. Once a press is stored,
 * every earlier press is settled by it, whatever order the answers arrive in.
 *
 * A save that fails may still have been stored, with only its reply lost. So
 * once no save is in flight, the switch reads the stored value back from the
 * account and settles the held value on it, which keeps the switch and the
 * account from disagreeing.
 */
export function useUnsupportedMarkerSwitch(
	value: boolean | null,
	setValue: (next: boolean | null) => void
): UnsupportedMarkerSwitch {
	const held = useRef<SwitchState>({
		doubtful: false,
		inFlight: 0,
		pending: [],
		pressCount: 0,
		shown: null,
		stored: null,
	});

	const onCheckedChange = useCallback(
		async (next: boolean) => {
			if (value === null || next === value) {
				return;
			}
			const state = held.current;
			if (state.inFlight === 0) {
				state.stored = value;
			}
			const press: PendingPress = { value: next };
			state.pending.push(press);
			state.inFlight += 1;
			state.pressCount += 1;
			state.shown = next;
			setValue(next);

			recordAnswer(state, press, await trySave(next));
			await readBackWhenQuiet(state);

			const latest = state.pending.at(-1);
			const target = latest ? latest.value : state.stored;
			if (target === null || target === state.shown) {
				return;
			}
			state.shown = target;
			setValue(target);
			toast({
				variant: "destructive",
				title: "Error",
				description: "Failed to save the unsupported marker setting",
			});
		},
		[value, setValue]
	);

	return {
		checked: value === true,
		disabled: value === null,
		onCheckedChange,
	};
}
