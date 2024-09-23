import { create } from 'zustand';

interface useResourcesModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const useResourcesModal = create<useResourcesModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
