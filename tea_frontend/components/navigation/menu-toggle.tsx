"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";
import type { Dispatch, SetStateAction } from "react";

interface MenuToggleButtonProps {
	setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export const MenuToggleButton = ({ setSidebarOpen }: MenuToggleButtonProps) => {
	return (
		<button
			className="-m-2.5 p-2.5 text-foreground lg:hidden"
			onClick={() => setSidebarOpen(true)}
			type="button"
		>
			<span className="sr-only">Open sidebar</span>
			<Bars3Icon aria-hidden="true" className="h-6 w-6" />
		</button>
	);
};

export default MenuToggleButton;
