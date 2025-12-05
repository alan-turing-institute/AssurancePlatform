import { create } from "zustand";

/**
 * Defines the shape of the state for the publish modal store.
 */
type PublishModalStore = {
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * The case ID being published/unpublished.
	 */
	caseId: string | null;

	/**
	 * Whether the case is currently published.
	 */
	isPublished: boolean;

	/**
	 * Number of case studies linked to this published case.
	 */
	linkedCaseStudyCount: number;

	/**
	 * Function to open the modal with initial state.
	 */
	onOpen: (
		caseId: string,
		isPublished: boolean,
		linkedCaseStudyCount: number
	) => void;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;
};

/**
 * Creates a Zustand store for managing the state of the publish modal.
 */
export const usePublishModal = create<PublishModalStore>((set) => ({
	isOpen: false,
	caseId: null,
	isPublished: false,
	linkedCaseStudyCount: 0,
	onOpen: (
		caseId: string,
		isPublished: boolean,
		linkedCaseStudyCount: number
	) => set({ isOpen: true, caseId, isPublished, linkedCaseStudyCount }),
	onClose: () =>
		set({
			isOpen: false,
			caseId: null,
			isPublished: false,
			linkedCaseStudyCount: 0,
		}),
}));
