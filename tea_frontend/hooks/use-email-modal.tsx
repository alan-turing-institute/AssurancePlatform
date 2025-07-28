import { create } from "zustand";

/**
 * Defines the shape of the state for the Email modal store.
 * @interface useEmailModalStore
 */
interface useEmailModalStore {
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
}

/**
 * Creates a Zustand store for managing the state of the Email modal.
 * @function
 * @returns {useEmailModalStore} The Zustand store with modal state and actions.
 */
export const useEmailModal = create<useEmailModalStore>((set) => ({
	isOpen: false,
	onOpen: () => set({ isOpen: true }),
	onClose: () => set({ isOpen: false }),
}));
