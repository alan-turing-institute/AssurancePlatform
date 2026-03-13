import { create } from "zustand";
import type { PublishStatusType } from "@/lib/services/case-response-types";

/**
 * Defines the shape of the state for the status modal store.
 */
interface StatusModalStore {
	/**
	 * The case ID being managed.
	 */
	caseId: string | null;

	/**
	 * Whether the case has changes since last publish.
	 */
	hasChanges: boolean;
	/**
	 * Indicates whether the modal is open or closed.
	 */
	isOpen: boolean;

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
	onOpen: (params: {
		caseId: string;
		status: PublishStatusType;
		hasChanges?: boolean;
		publishedAt?: Date | string | null;
		linkedCaseStudyCount?: number;
	}) => void;

	/**
	 * When the case was last published.
	 */
	publishedAt: Date | string | null;

	/**
	 * Current publish status of the case.
	 */
	status: PublishStatusType;

	/**
	 * Function to update the current state without closing.
	 */
	updateState: (
		params: Partial<
			Omit<StatusModalStore, "isOpen" | "onOpen" | "onClose" | "updateState">
		>
	) => void;
}

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
