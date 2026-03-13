import { create } from "zustand";

/**
 * Defines the shape of the state for the publish modal store.
 */
interface PublishModalStore {
	/**
	 * The case ID being published/unpublished.
	 */
	caseId: string | null;
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * Whether the case is currently published.
	 */
	isPublished: boolean;

	/**
	 * Number of case studies linked to this published case.
	 */
	linkedCaseStudyCount: number;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;

	/**
	 * Function to open the modal with initial state.
	 */
	onOpen: (
		caseId: string,
		isPublished: boolean,
		linkedCaseStudyCount: number
	) => void;
}

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
