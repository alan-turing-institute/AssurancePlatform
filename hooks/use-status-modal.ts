import { create } from "zustand";
import type { PublishStatusType } from "@/components/publishing/status-badge";

/**
 * Defines the shape of the state for the status modal store.
 */
type StatusModalStore = {
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

	/**
	 * The case ID being managed.
	 */
	caseId: string | null;

	/**
	 * Current publish status of the case.
	 */
	status: PublishStatusType;

	/**
	 * Whether the case has changes since last publish.
	 */
	hasChanges: boolean;

	/**
	 * When the case was last published.
	 */
	publishedAt: Date | string | null;

	/**
	 * Number of case studies linked to this published case.
	 */
	linkedCaseStudyCount: number;

	/**
	 * Function to open the modal with initial state.
	 */
	onOpen: (params: {
		caseId: string;
		status: PublishStatusType;
		hasChanges?: boolean;
		publishedAt?: Date | string | null;
		linkedCaseStudyCount?: number;
	}) => void;

	/**
	 * Function to update the current state without closing.
	 */
	updateState: (
		params: Partial<
			Omit<StatusModalStore, "isOpen" | "onOpen" | "onClose" | "updateState">
		>
	) => void;

	/**
	 * Function to close the modal.
	 */
	onClose: () => void;
};

/**
 * Creates a Zustand store for managing the state of the status modal.
 * Used by StatusButton and StatusModal components to coordinate publishing workflow.
 */
export const useStatusModal = create<StatusModalStore>((set) => ({
	isOpen: false,
	caseId: null,
	status: "DRAFT",
	hasChanges: false,
	publishedAt: null,
	linkedCaseStudyCount: 0,
	onOpen: ({
		caseId,
		status,
		hasChanges = false,
		publishedAt = null,
		linkedCaseStudyCount = 0,
	}) =>
		set({
			isOpen: true,
			caseId,
			status,
			hasChanges,
			publishedAt,
			linkedCaseStudyCount,
		}),
	updateState: (params) => set(params),
	onClose: () =>
		set({
			isOpen: false,
			caseId: null,
			status: "DRAFT",
			hasChanges: false,
			publishedAt: null,
			linkedCaseStudyCount: 0,
		}),
}));
