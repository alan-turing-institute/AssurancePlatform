import { create } from 'zustand';

interface useResourcesModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Zustand store hook to manage the state of a resources modal.
 * 
 * This store manages the `isOpen` state of a modal, providing `onOpen` and `onClose` methods to control the modal's visibility.
 * 
 * @typedef {Object} useResourcesModalStore
 * @property {boolean} isOpen - Represents whether the modal is currently open or closed.
 * @property {function} onOpen - Opens the modal by setting `isOpen` to `true`.
 * @property {function} onClose - Closes the modal by setting `isOpen` to `false`.
 * 
 * @returns {useResourcesModalStore} Zustand store object with `isOpen`, `onOpen`, and `onClose`.
 * 
 * @example
 * const { isOpen, onOpen, onClose } = useResourcesModal();
 * 
 * return (
 *   <div>
 *     <button onClick={onOpen}>Open Modal</button>
 *     {isOpen && <Modal onClose={onClose} />}
 *   </div>
 * );
 */
export const useResourcesModal = create<useResourcesModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
