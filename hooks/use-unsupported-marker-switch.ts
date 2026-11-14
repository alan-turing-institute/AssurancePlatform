"use client";

import { useCallback, useEffect, useRef } from "react";
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

/** What the switch remembers between presses. */
interface SwitchState {
	/** True once a save has failed, until the stored value has been read back. */
	doubtful: boolean;
	/** True once the switch has been unmounted, so a late answer writes nothing. */
	gone: boolean;
	/** Saves, and reads of the stored value, that have not come back yet. */
	inFlight: number;
	/** How many presses have been made. Each press is numbered, and a read can tell a press came after it started. */
	pressCount: number;
	/** The number of the newest press whose save has been stored. An earlier press answered after it is out of date. */
	settledThrough: number;
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
 * Takes the answer to press number `press` into account. A save that came
 * back with a value is stored, and settles every earlier press with it, unless
 * a later press has already been stored. A save that failed leaves the account
 * in doubt, because the server may have stored the value and lost the reply.
 */
function recordAnswer(
	state: SwitchState,
	press: number,
	saved: boolean | null
): void {
	state.inFlight -= 1;
	if (saved === null) {
		state.doubtful = true;
	} else if (press > state.settledThrough) {
		state.stored = saved;
		state.settledThrough = press;
	}
}

/**
 * Once nothing is in flight and a save has failed, reads the stored value from
 * the account and keeps it as the known stored value. A read that cannot be
 * made leaves the last known value. A read is also dropped when a press was
 * made after it started, because that press's own answer is newer. Nothing is
 * read once the switch has been unmounted.
 */
async function readBackWhenQuiet(state: SwitchState): Promise<void> {
	while (!state.gone && state.inFlight === 0 && state.doubtful) {
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
 * at once, then saves it to the account. While any save is still out, the
 * switch keeps showing the latest press. Once every save has come back it
 * settles on the last value known to be stored, and says so with a message
 * when that is not what it was showing. Presses are ordered by when they were
 * made, and a press that is stored settles every earlier press, whatever
 * order the answers arrive in.
 *
 * A save that fails may still have been stored, with only its reply lost. So
 * once no save is in flight, the switch reads the stored value back from the
 * account and settles on that, which keeps the switch and the account from
 * disagreeing. A switch that has been unmounted writes nothing, because the
 * held value may by then belong to another page.
 */
export function useUnsupportedMarkerSwitch(
	value: boolean | null,
	setValue: (next: boolean | null) => void
): UnsupportedMarkerSwitch {
	const held = useRef<SwitchState>({
		doubtful: false,
		gone: false,
		inFlight: 0,
		pressCount: 0,
		settledThrough: 0,
		shown: null,
		stored: null,
	});

	// Cleared again on mount, so a development double mount does not leave a live switch marked as gone.
	useEffect(() => {
		held.current.gone = false;
		return () => {
			held.current.gone = true;
		};
	}, []);

	const onCheckedChange = useCallback(
		async (next: boolean) => {
			if (value === null || next === value) {
				return;
			}
			const state = held.current;
			if (state.inFlight === 0) {
				state.stored = value;
			}
			state.inFlight += 1;
			state.pressCount += 1;
			const press = state.pressCount;
			state.shown = next;
			setValue(next);

			recordAnswer(state, press, await trySave(next));
			await readBackWhenQuiet(state);

			if (state.gone || state.inFlight > 0) {
				return;
			}
			const target = state.stored;
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
