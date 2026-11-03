import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clear the mock from the global setup to test the actual implementations
vi.unmock("@/hooks/modal-hooks");

import { createPresetModalStore } from "@/hooks/create-modal-store";
import {
	type PublishedPatternPreset,
	useCreateCaseModal,
	useCreateTeamModal,
	useEmailModal,
	useExportModal,
	useHelpModal,
	useImportModal,
	usePermissionsModal,
} from "@/hooks/modal-hooks";

/**
 * The new-case dialog's store can be opened with a published pattern already
 * chosen. The choice lasts for that opening only: closing, or opening plainly,
 * clears it, and no other dialog's store gains it.
 */

const FAIRNESS: PublishedPatternPreset = {
	slug: "fairness-pattern",
	title: "Fairness pattern",
	description: "How a system treats groups alike",
};
const PRIVACY: PublishedPatternPreset = {
	slug: "privacy-pattern",
	title: "Privacy pattern",
	description: "",
};

const state = () => useCreateCaseModal.getState();

beforeEach(() => {
	act(() => {
		state().onClose();
	});
});

describe("the new-case dialog's store with a preset", () => {
	it("starts closed with no preset", () => {
		expect(state().isOpen).toBe(false);
		expect(state().preset).toBeUndefined();
	});

	it("opens with the preset it is given", () => {
		act(() => {
			state().onOpenWith(FAIRNESS);
		});

		expect(state().isOpen).toBe(true);
		expect(state().preset).toEqual(FAIRNESS);
	});

	it("opens plainly, with no preset, on onOpen", () => {
		act(() => {
			state().onOpen();
		});

		expect(state().isOpen).toBe(true);
		expect(state().preset).toBeUndefined();
	});

	it("drops the preset when it is opened plainly while open with one", () => {
		act(() => {
			state().onOpenWith(FAIRNESS);
			state().onOpen();
		});

		expect(state().isOpen).toBe(true);
		expect(state().preset).toBeUndefined();
	});

	it("drops the preset when it is closed", () => {
		act(() => {
			state().onOpenWith(FAIRNESS);
		});
		act(() => {
			state().onClose();
		});

		expect(state().isOpen).toBe(false);
		expect(state().preset).toBeUndefined();
	});

	it("opens plainly after a preset opening was closed", () => {
		act(() => {
			state().onOpenWith(FAIRNESS);
		});
		act(() => {
			state().onClose();
		});
		act(() => {
			state().onOpen();
		});

		expect(state().isOpen).toBe(true);
		expect(state().preset).toBeUndefined();
	});

	it("takes the latest preset when opened with a second one", () => {
		act(() => {
			state().onOpenWith(FAIRNESS);
			state().onOpenWith(PRIVACY);
		});

		expect(state().preset).toEqual(PRIVACY);
		expect(state().isOpen).toBe(true);
	});

	it("opens plainly when onOpen is used as an event handler and is handed the event", () => {
		const { result } = renderHook(() => useCreateCaseModal());
		const asHandler = result.current.onOpen as (event: unknown) => void;

		act(() => {
			asHandler({ type: "click", target: FAIRNESS });
		});

		expect(result.current.isOpen).toBe(true);
		expect(result.current.preset).toBeUndefined();
	});

	it("tells components using the hook about the preset and about it going", () => {
		const { result } = renderHook(() => useCreateCaseModal());

		act(() => {
			result.current.onOpenWith(FAIRNESS);
		});
		expect(result.current.preset).toEqual(FAIRNESS);

		act(() => {
			result.current.onClose();
		});
		expect(result.current.preset).toBeUndefined();
	});

	it("keeps the stores of separate dialogs apart", () => {
		const first = createPresetModalStore<PublishedPatternPreset>();
		const second = createPresetModalStore<PublishedPatternPreset>();

		first.getState().onOpenWith(FAIRNESS);

		expect(first.getState().preset).toEqual(FAIRNESS);
		expect(second.getState().isOpen).toBe(false);
		expect(second.getState().preset).toBeUndefined();
	});
});

describe("the other dialogs' stores", () => {
	it.each([
		["team", useCreateTeamModal],
		["email", useEmailModal],
		["export", useExportModal],
		["import", useImportModal],
		["permissions", usePermissionsModal],
		["help", useHelpModal],
	])("the %s dialog's store still holds only open state and its two actions", (_label, store) => {
		expect(Object.keys(store.getState()).sort()).toEqual([
			"isOpen",
			"onClose",
			"onOpen",
		]);
	});

	it("opening the new-case dialog with a preset does not open another", () => {
		act(() => {
			state().onOpenWith(FAIRNESS);
		});

		expect(useCreateTeamModal.getState().isOpen).toBe(false);
		expect(useImportModal.getState().isOpen).toBe(false);
	});
});
