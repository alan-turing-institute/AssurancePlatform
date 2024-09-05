import { create } from 'zustand';

interface useEmailModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const useEmailModal = create<useEmailModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
