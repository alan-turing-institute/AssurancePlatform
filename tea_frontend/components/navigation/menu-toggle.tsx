'use client';

import { Bars3Icon } from '@heroicons/react/24/outline';
import { Dispatch, SetStateAction } from 'react';

interface MenuToggleButtonProps {
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export const MenuToggleButton = ({ setSidebarOpen }: MenuToggleButtonProps) => {
  return (
    <button
      type="button"
      className="-m-2.5 p-2.5 text-foreground lg:hidden"
      onClick={() => setSidebarOpen(true)}
    >
      <span className="sr-only">Open sidebar</span>
      <Bars3Icon className="h-6 w-6" aria-hidden="true" />
    </button>
  );
};

export default MenuToggleButton;
