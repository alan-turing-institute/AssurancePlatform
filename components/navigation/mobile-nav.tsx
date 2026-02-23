"use client";

import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ExternalLink, PlusCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Dispatch, Fragment, type SetStateAction } from "react";
import { externalNavigation, navigation } from "@/config";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
import { useSidebarLogo } from "@/hooks/use-sidebar-logo";
import { Separator } from "../ui/separator";
import LoggedInUser from "./logged-in-user";

type Team = {
	id: string;
	name: string;
	slug: string;
};

type MobileNavProps = {
	sidebarOpen: boolean;
	setSidebarOpen: Dispatch<SetStateAction<boolean>>;
	teams: Team[];
};

function classNames(...classes: (string | boolean | undefined | null)[]) {
	return classes.filter(Boolean).join(" ");
}

export const MobileNav = ({
	sidebarOpen,
	setSidebarOpen,
	teams,
}: MobileNavProps) => {
	const pathname = usePathname();
	const createTeamModal = useCreateTeamModal();
	const sidebarLogo = useSidebarLogo();

	return (
		<Transition.Root as={Fragment} show={sidebarOpen}>
			<Dialog
				as="div"
				className="relative z-50 lg:hidden"
				onClose={setSidebarOpen}
			>
				<Transition.Child
					as={Fragment}
					enter="transition-opacity ease-linear duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="transition-opacity ease-linear duration-300"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className="fixed inset-0 bg-foreground/80" />
				</Transition.Child>

				<div className="fixed inset-0 flex">
					<Transition.Child
						as={Fragment}
						enter="transition ease-in-out duration-300 transform"
						enterFrom="-translate-x-full"
						enterTo="translate-x-0"
						leave="transition ease-in-out duration-300 transform"
						leaveFrom="translate-x-0"
						leaveTo="-translate-x-full"
					>
						<Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
							<Transition.Child
								as={Fragment}
								enter="ease-in-out duration-300"
								enterFrom="opacity-0"
								enterTo="opacity-100"
								leave="ease-in-out duration-300"
								leaveFrom="opacity-100"
								leaveTo="opacity-0"
							>
								<div className="absolute top-0 left-full flex w-16 justify-center pt-5">
									<button
										className="-m-2.5 p-2.5"
										onClick={() => setSidebarOpen(false)}
										type="button"
									>
										<span className="sr-only">Close sidebar</span>
										<XMarkIcon
											aria-hidden="true"
											className="h-6 w-6 text-background"
										/>
									</button>
								</div>
							</Transition.Child>
							{/* Sidebar component, swap this element with another sidebar if you like */}
							<div className="flex grow flex-col gap-y-5 overflow-y-auto bg-sidebar px-6 pb-4">
								<div className="my-4 flex shrink-0 items-center">
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
																"group flex gap-x-3 rounded-md p-2 font-semibold text-sm leading-6"
															)}
															href={item.href}
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
														</a>
													</li>
												))}
											</ul>
										</li>
										<li>
											<div className="flex items-center justify-between">
												<div className="font-semibold text-sidebar-foreground text-xs leading-6">
													Your teams
												</div>
												<button
													className="rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
													onClick={() => {
														setSidebarOpen(false);
														createTeamModal.onOpen();
													}}
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
																onClick={() => setSidebarOpen(false)}
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
															className="group flex gap-x-3 rounded-md p-2 font-semibold text-sidebar-foreground text-sm leading-6 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
															href={item.href}
															rel="noopener"
															target="_blank"
														>
															<item.icon
																aria-hidden="true"
																className="h-6 w-6 shrink-0 text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
															/>
															{item.name}
															{item.externalLink && (
																<ExternalLink className="ml-auto hidden h-4 w-4 group-hover:block" />
															)}
														</a>
													</li>
												))}
											</ul>
										</li>
									</ul>

									<Separator className="my-4 bg-sidebar-border" />

									<LoggedInUser />
								</nav>
							</div>
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition.Root>
	);
};
