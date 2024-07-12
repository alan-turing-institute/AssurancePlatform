import { create } from 'zustand';

interface useImportModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const useImportModal = create<useImportModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
