import { create } from 'zustand';

interface usePermissionsModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const usePermissionsModal = create<usePermissionsModalStore>((set: any) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
