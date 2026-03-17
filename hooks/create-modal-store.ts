import { create } from "zustand";

interface ModalStore {
	isOpen: boolean;
	onClose: () => void;
	onOpen: () => void;
}

export function createModalStore() {
	return create<ModalStore>((set) => ({
		isOpen: false,
		onOpen: () => set({ isOpen: true }),
		onClose: () => set({ isOpen: false }),
	}));
}
