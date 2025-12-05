import { create } from "zustand";

/**
 * Defines the shape of the state for the invite member modal store.
 */
type InviteMemberModalStore = {
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * The team ID to invite a member to.
	 */
	teamId: string | null;

	/**
	 * Function to open the modal with a team ID.
	 */
	onOpen: (teamId: string) => void;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;
};

/**
 * Creates a Zustand store for managing the state of the invite member modal.
 */
export const useInviteMemberModal = create<InviteMemberModalStore>((set) => ({
	isOpen: false,
	teamId: null,
	onOpen: (teamId: string) => set({ isOpen: true, teamId }),
	onClose: () => set({ isOpen: false, teamId: null }),
}));
