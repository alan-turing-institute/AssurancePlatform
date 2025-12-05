import { create } from "zustand";

/**
 * Defines the shape of the state for the create team modal store.
 */
type CreateTeamModalStore = {
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * Function to open the modal.
	 */
	onOpen: () => void;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;
};

/**
 * Creates a Zustand store for managing the state of the create team modal.
 */
export const useCreateTeamModal = create<CreateTeamModalStore>((set) => ({
	isOpen: false,
	onOpen: () => set({ isOpen: true }),
	onClose: () => set({ isOpen: false }),
}));
