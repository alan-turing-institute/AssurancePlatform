import { create } from "zustand";

/**
 * Defines the shape of the state for the Export modal store.
 * @interface useExportModalStore
 */
type useExportModalStore = {
	/**
	 * Indicates whether the modal is open or closed.
	 * @type {boolean}
	 */
	isOpen: boolean;

	/**
	 * Function to open the modal.
	 * @function
	 */
	onOpen: () => void;

	/**
	 * Function to close the modal.
	 * @function
	 */
	onClose: () => void;
};

/**
 * Creates a Zustand store for managing the state of the Export modal.
 * @function
 * @returns {useExportModalStore} The Zustand store with modal state and actions.
 */
export const useExportModal = create<useExportModalStore>((set) => ({
	isOpen: false,
	onOpen: () => set({ isOpen: true }),
	onClose: () => set({ isOpen: false }),
}));
