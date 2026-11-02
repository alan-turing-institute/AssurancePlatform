import { create } from "zustand";

interface ModalStore {
	isOpen: boolean;
	onClose: () => void;
	onOpen: () => void;
}

interface PresetModalStore<Preset> extends ModalStore {
	/** Opens the dialog with a choice made for the user, who still confirms it. */
	onOpenWith: (preset: Preset) => void;
	/** The choice the dialog was opened with; cleared when it closes or opens plainly. */
	preset: Preset | undefined;
}

export function createModalStore() {
	return create<ModalStore>((set) => ({
		isOpen: false,
		onOpen: () => set({ isOpen: true }),
		onClose: () => set({ isOpen: false }),
	}));
}

/** A modal store whose dialog can also be opened with a choice already made. */
export function createPresetModalStore<Preset>() {
	return create<PresetModalStore<Preset>>((set) => ({
		isOpen: false,
		preset: undefined,
		onOpen: () => set({ isOpen: true, preset: undefined }),
		onOpenWith: (preset) => set({ isOpen: true, preset }),
		onClose: () => set({ isOpen: false, preset: undefined }),
	}));
}
