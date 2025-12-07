"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/auth/logout-button";
import FeedbackBanner from "@/components/feedback-banner";
import { ModeToggle } from "@/components/ui/theme-toggle";
import DesktopNav from "./desktop-nav";
import MenuToggleButton from "./menu-toggle";
import { MobileNav } from "./mobile-nav";

export const Navbar = ({ children }: { children: React.ReactNode }) => {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const pathname = usePathname();
	const getPageName = (path: string): string => {
		if (path === "/") {
			return "assurance cases";
		}
		if (path.includes("/dashboard/case-studies")) {
			return "Case Studies";
		}
		return path.split("/").filter(Boolean).pop() || "";
	};

	const pageName = getPageName(pathname);

	return (
		<div>
			<MobileNav setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />

			{/* Static sidebar for desktop */}
			<DesktopNav />

			<div className="lg:pl-72">
				<div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-foreground/10 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
					<MenuToggleButton setSidebarOpen={setSidebarOpen} />

					<div className="flex flex-1 items-center justify-start">
						<h2 className="font-medium text-foreground capitalize">
							{pageName}
						</h2>
					</div>

					<div className="flex justify-end gap-x-4 self-stretch lg:gap-x-6">
						<div className="flex items-center gap-x-4 lg:gap-x-6">
							{/* <button type="button" className="-m-2.5 p-2.5 text-foreground hover:text-foreground/80">
                <span className="sr-only">View notifications</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
              </button> */}

							<div
								aria-hidden="true"
								className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10"
							/>
							<LogoutButton />
							<ModeToggle />
						</div>
					</div>
				</div>

				<main className="bg-background text-foreground">
					<div>
						{children}
						<FeedbackBanner />
					</div>
				</main>
			</div>
		</div>
	);
};
