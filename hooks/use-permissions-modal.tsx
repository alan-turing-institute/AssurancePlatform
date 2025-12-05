import { create } from "zustand";

/**
 * Defines the shape of the state for the Permissions modal store.
 * @interface usePermissionsModalStore
 */
type usePermissionsModalStore = {
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
 * Creates a Zustand store for managing the state of the Permissions modal.
 * @function
 * @returns {usePermissionsModalStore} The Zustand store with modal state and actions.
 */
export const usePermissionsModal = create<usePermissionsModalStore>((set) => ({
	isOpen: false,
	onOpen: () => set({ isOpen: true }),
	onClose: () => set({ isOpen: false }),
}));
