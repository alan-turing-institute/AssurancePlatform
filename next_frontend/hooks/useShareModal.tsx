import { create } from 'zustand';

interface useShareModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const useShareModal = create<useShareModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
