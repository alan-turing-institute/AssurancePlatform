"use client";

import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ExternalLink, PlusCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	type Dispatch,
	Fragment,
	type SetStateAction,
	useEffect,
	useState,
} from "react";
import { externalNavigation, navigation } from "@/config";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
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
};

function classNames(...classes: (string | boolean | undefined | null)[]) {
	return classes.filter(Boolean).join(" ");
}

export const MobileNav = ({ sidebarOpen, setSidebarOpen }: MobileNavProps) => {
	const pathname = usePathname();
	const createTeamModal = useCreateTeamModal();
	const [teams, setTeams] = useState<Team[]>([]);

	// Page name determined from pathname
	const _pageName =
		pathname === "/" ? "assurance cases" : pathname.split("/")[1];

	useEffect(() => {
		const fetchTeams = async () => {
			try {
				const response = await fetch("/api/teams");
				if (response.ok) {
					const data = await response.json();
					setTeams(data);
				}
			} catch (error) {
				console.error("Failed to fetch teams:", error);
			}
		};

		fetchTeams();
	}, []);

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
					<div className="fixed inset-0 bg-gray-900/80" />
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
											className="h-6 w-6 text-white"
										/>
									</button>
								</div>
							</Transition.Child>
							{/* Sidebar component, swap this element with another sidebar if you like */}
							<div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 px-6 pb-4 dark:bg-slate-900">
								<div className="my-4 flex h-16 shrink-0 items-center">
									{/* <Link href={'/dashboard'}>
                    <p className='text-white font-semibold flex justify-start items-center gap-2'>
                      <svg className='w-6 h-6' fill='white' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 2v2.06A8.522 8.522 0 0 0 4.05 9H2v6h2.06A8.494 8.494 0 0 0 9 19.95V22h6v-2.06A8.494 8.494 0 0 0 19.95 15H22V9h-2.06A8.522 8.522 0 0 0 15 4.05V2m-4 2h2v2h-2m-2 .25V8h6V6.25c1.18.61 2.14 1.57 2.75 2.75H16v6h1.75A6.406 6.406 0 0 1 15 17.75V16H9v1.75A6.406 6.406 0 0 1 6.25 15H8V9H6.25A6.406 6.406 0 0 1 9 6.25M4 11h2v2H4m14-2h2v2h-2m-7 5h2v2h-2"></path></svg>
                      Assurance Platform
                    </p>
                  </Link> */}
									<Link href={"/dashboard"}>
										<div className="my-3 flex items-center justify-start gap-2 font-semibold text-white">
											{/* <svg className='w-6 h-6' fill='white' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 2v2.06A8.522 8.522 0 0 0 4.05 9H2v6h2.06A8.494 8.494 0 0 0 9 19.95V22h6v-2.06A8.494 8.494 0 0 0 19.95 15H22V9h-2.06A8.522 8.522 0 0 0 15 4.05V2m-4 2h2v2h-2m-2 .25V8h6V6.25c1.18.61 2.14 1.57 2.75 2.75H16v6h1.75A6.406 6.406 0 0 1 15 17.75V16H9v1.75A6.406 6.406 0 0 1 6.25 15H8V9H6.25A6.406 6.406 0 0 1 9 6.25M4 11h2v2H4m14-2h2v2h-2m-7 5h2v2h-2"></path></svg> */}
											<Image
												alt="Turing Ethical Assurance Logo"
												className="w-16"
												height={64}
												priority
												src="/images/tea-logo2.png"
												style={{ height: "auto" }}
												unoptimized
												width={64}
											/>
											<span className="-ml-3 text-sm leading-4">
												Trustworthy and Ethical Assurance Platform
											</span>
										</div>
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
																	? "bg-indigo-700 text-white"
																	: "text-indigo-200 hover:bg-indigo-700 hover:text-white dark:hover:bg-indigo-700/60",
																"group flex gap-x-3 rounded-md p-2 font-semibold text-sm leading-6"
															)}
															href={item.href}
															target={item.externalLink ? "_blank" : "_self"}
														>
															<item.icon
																aria-hidden="true"
																className={classNames(
																	item.current
																		? "text-white"
																		: "text-indigo-200 group-hover:text-white",
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
												<div className="font-semibold text-indigo-200 text-xs leading-6">
													Your teams
												</div>
												<button
													className="rounded p-1 text-indigo-200 hover:bg-indigo-700 hover:text-white"
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
													<p className="px-2 text-indigo-100/60 text-sm dark:text-slate-300/50">
														No teams added
													</p>
												)}
												{teams.length > 0 &&
													teams.map((team) => (
														<li key={team.id}>
															<Link
																className={classNames(
																	pathname === `/dashboard/teams/${team.id}`
																		? "bg-indigo-700 text-white"
																		: "text-indigo-200 hover:bg-indigo-700 hover:text-white",
																	"group flex gap-x-3 rounded-md p-2 font-semibold text-sm leading-6"
																)}
																href={`/dashboard/teams/${team.id}`}
																onClick={() => setSidebarOpen(false)}
															>
																<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-indigo-400 bg-indigo-500 font-medium text-[0.625rem] text-white">
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
															className="group flex gap-x-3 rounded-md p-2 font-semibold text-indigo-200 text-sm leading-6 hover:bg-indigo-700 hover:text-white"
															href={item.href}
															rel="noopener"
															target="_blank"
														>
															<item.icon
																aria-hidden="true"
																className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
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

									<Separator className="my-4 bg-indigo-700/80 dark:bg-slate-800" />

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
