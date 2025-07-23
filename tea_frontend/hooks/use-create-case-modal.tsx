import { create } from "zustand";

/**
 * Defines the shape of the state for the create case modal store.
 * @interface useCreateCaseModalStore
 */
interface useCreateCaseModalStore {
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
 * Creates a Zustand store for managing the state of the create case modal.
 * @function
 * @returns {useCreateCaseModalStore} The Zustand store with modal state and actions.
 */
export const useCreateCaseModal = create<useCreateCaseModalStore>((set) => ({
	isOpen: false,
	onOpen: () => set({ isOpen: true }),
	onClose: () => set({ isOpen: false }),
}));
