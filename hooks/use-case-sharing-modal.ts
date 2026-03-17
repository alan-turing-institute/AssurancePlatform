import { create } from "zustand";

/**
 * Defines the shape of the state for the case sharing modal store.
 */
interface CaseSharingModalStore {
	/**
	 * The case ID being shared.
	 */
	caseId: string | null;
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;

	/**
	 * Function to open the modal with a case ID.
	 */
	onOpen: (caseId: string) => void;
}

/**
 * Creates a Zustand store for managing the state of the case sharing modal.
 */
export const useCaseSharingModal = create<CaseSharingModalStore>((set) => ({
	isOpen: false,
	caseId: null,
	onOpen: (caseId: string) => set({ isOpen: true, caseId }),
	onClose: () => set({ isOpen: false, caseId: null }),
}));
