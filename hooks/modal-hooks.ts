import { createModalStore, createPresetModalStore } from "./create-modal-store";

/**
 * A pattern published on Discover that the new-case dialog opens with chosen,
 * described by what its Discover page already shows.
 */
export interface PublishedPatternPreset {
	description: string;
	slug: string;
	title: string;
}

export const useCreateCaseModal =
	createPresetModalStore<PublishedPatternPreset>();
export const useCreateTeamModal = createModalStore();
export const useEmailModal = createModalStore();
export const useExportModal = createModalStore();
export const useHelpModal = createModalStore();
export const useImportModal = createModalStore();
export const usePermissionsModal = createModalStore();
