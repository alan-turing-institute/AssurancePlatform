import { create } from 'zustand';

/**
 * Defines the shape of the state for the Import modal store.
 * @interface useImportModalStore
 */
interface useImportModalStore {
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
}

/**
 * Creates a Zustand store for managing the state of the Import modal.
 * @function
 * @returns {useImportModalStore} The Zustand store with modal state and actions.
 */
export const useImportModal = create<useImportModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
