import { create } from "zustand";

/**
 * Defines the shape of the state for the Migration modal store.
 */
type MigrationModalStore = {
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * Indicates whether the user is missing a valid email address.
	 * Used to show conditional UI and prevent permanent dismissal.
	 */
	isMissingEmail: boolean;

	/**
	 * Function to open the modal.
	 * @param isMissingEmail - Whether the user is missing a valid email
	 */
	onOpen: (isMissingEmail: boolean) => void;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;
};

/**
 * Creates a Zustand store for managing the state of the Migration modal.
 * This modal informs users about the platform migration and prompts
 * users without email addresses to add one.
 */
export const useMigrationModal = create<MigrationModalStore>((set) => ({
	isOpen: false,
	isMissingEmail: false,
	onOpen: (isMissingEmail: boolean) => set({ isOpen: true, isMissingEmail }),
	onClose: () => set({ isOpen: false }),
}));
