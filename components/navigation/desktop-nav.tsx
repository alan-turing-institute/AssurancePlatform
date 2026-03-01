"use client";

import { ExternalLink, PlusCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { externalNavigation, navigation } from "@/config";
import { useCreateTeamModal } from "@/hooks/modal-hooks";
import { useSidebarLogo } from "@/hooks/use-sidebar-logo";
import { Separator } from "../ui/separator";
import LoggedInUser from "./logged-in-user";

type Team = {
	id: string;
	name: string;
	slug: string;
};

function classNames(...classes: (string | boolean | undefined | null)[]) {
	return classes.filter(Boolean).join(" ");
}

type DesktopNavProps = {
	teams: Team[];
};

const DesktopNav = ({ teams }: DesktopNavProps) => {
	const pathname = usePathname();
	const createTeamModal = useCreateTeamModal();
	const sidebarLogo = useSidebarLogo();

	return (
		<div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
			<div className="flex grow flex-col gap-y-5 overflow-y-auto border-sidebar-border border-r bg-sidebar px-6 pb-4">
				<div className="flex shrink-0 items-center">
					<Link href={"/dashboard"}>
						<Image
							alt="Trustworthy and Ethical Assurance Platform"
							className="mt-6 mb-3 h-10"
							height={432}
							priority
							src={sidebarLogo}
							style={{ width: "auto" }}
							unoptimized
							width={1967}
						/>
					</Link>
				</div>
				<nav className="flex flex-1 flex-col">
					<ul className="flex flex-1 flex-col gap-y-4">
						<li>
							<ul className="-mx-2 space-y-1">
								{navigation.map((item) => (
									<li key={item.name}>
										<a
											className={classNames(
												item.href === pathname
													? "bg-sidebar-accent text-sidebar-accent-foreground"
													: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
												"group flex items-center gap-x-3 rounded-md p-2 font-semibold text-sm leading-6"
											)}
											data-tour={item.tourId}
											href={item.href}
											rel={
												item.externalLink ? "noopener noreferrer" : undefined
											}
											target={item.externalLink ? "_blank" : "_self"}
										>
											<item.icon
												aria-hidden="true"
												className={classNames(
													item.current
														? "text-sidebar-accent-foreground"
														: "text-sidebar-foreground group-hover:text-sidebar-accent-foreground",
													"h-6 w-6 shrink-0"
												)}
											/>
											{item.name}
											{item.externalLink && (
												<>
													<ExternalLink
														aria-hidden="true"
														className="ml-auto h-4 w-4 shrink-0"
													/>
													<span className="sr-only">(opens in new tab)</span>
												</>
											)}
										</a>
									</li>
								))}
							</ul>
						</li>
						<Separator className="bg-sidebar-border" />
						<li>
							<div className="flex items-center justify-between">
								<div className="font-semibold text-sidebar-foreground text-xs leading-6">
									Your teams
								</div>
								<button
									className="rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
									onClick={() => createTeamModal.onOpen()}
									title="Create team"
									type="button"
								>
									<PlusCircle className="h-4 w-4" />
								</button>
							</div>
							<ul className="-mx-2 mt-2 space-y-1">
								{teams.length === 0 && (
									<p className="px-2 text-sidebar-muted text-sm">
										No teams added
									</p>
								)}
								{teams.length > 0 &&
									teams.map((team) => (
										<li key={team.id}>
											<Link
												className={classNames(
													pathname === `/dashboard/teams/${team.id}`
														? "bg-sidebar-accent text-sidebar-accent-foreground"
														: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
													"group flex gap-x-3 rounded-md p-2 font-semibold text-sm leading-6"
												)}
												href={`/dashboard/teams/${team.id}`}
											>
												<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sidebar-foreground/40 bg-sidebar-accent font-medium text-[0.625rem] text-sidebar-accent-foreground">
													{team.name.charAt(0).toUpperCase()}
												</span>
												<span className="truncate">{team.name}</span>
											</Link>
										</li>
									))}
							</ul>
						</li>
						<li className="mt-auto">
							<ul className="-mx-2 space-y-1">
								{externalNavigation.map((item) => (
									<li key={item.name}>
										<a
											className="group flex items-center gap-x-3 rounded-md p-2 font-semibold text-sidebar-foreground text-sm leading-6 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
											data-tour={item.tourId}
											href={item.href}
											rel="noopener noreferrer"
											target="_blank"
										>
											<item.icon
												aria-hidden="true"
												className="h-6 w-6 shrink-0 text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
											/>
											{item.name}
											<ExternalLink
												aria-hidden="true"
												className="ml-auto h-4 w-4 shrink-0"
											/>
											<span className="sr-only">(opens in new tab)</span>
										</a>
									</li>
								))}
							</ul>
						</li>
						{/* <li className="">
              <Link
                href="/dashboard/settings"
                className={`group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${pathname === '/dashboard/settings' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : null}`}
              >
                <Cog6ToothIcon
                  className="h-6 w-6 shrink-0 text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
                  aria-hidden="true"
                />
                Settings
              </Link>
            </li> */}
					</ul>

					<Separator className="my-4 bg-sidebar-border" />

					<LoggedInUser />
				</nav>
			</div>
		</div>
	);
};

export default DesktopNav;
