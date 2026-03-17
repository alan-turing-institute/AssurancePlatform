"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";

interface MenuToggleButtonProps {
	setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export const MenuToggleButton = ({ setSidebarOpen }: MenuToggleButtonProps) => (
	<Button
		className="-m-2.5 lg:hidden"
		onClick={() => setSidebarOpen(true)}
		size="icon"
		type="button"
		variant="ghost"
	>
		<span className="sr-only">Open sidebar</span>
		<Bars3Icon aria-hidden="true" className="h-6 w-6" />
	</Button>
);

export default MenuToggleButton;
