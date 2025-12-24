"use client";

import { Dialog } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

function Header() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [loggedIn, setLoggedIn] = useState(false);

	const navigation = [
		// { name: 'Showcase', href: '/documentation' },
		{ name: "Documentation", href: "/docs", external: false },
		// { name: 'Documentation', href: 'https://alan-turing-institute.github.io/AssurancePlatform/' },
		{
			name: "GitHub",
			href: "https://github.com/alan-turing-institute/AssurancePlatform",
			external: true,
		},
		{ name: "Discover", href: "/discover", external: false },
	];

	const { data: session } = useSession();

	useEffect(() => {
		// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
		if (session?.user?.id) {
			setLoggedIn(true);
		}
	}, [session?.user?.id]);

	return (
		<header className="">
			<nav
				aria-label="Global"
				className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8"
			>
				<div className="flex lg:flex-1">
					<Link
						className="-m-1.5 flex items-center justify-start gap-2 p-1.5"
						href="/"
					>
						<Image
							alt="TEA Platform Logo"
							className="h-12 w-auto"
							height={48}
							priority
							src="/images/logos/tea-logo-full-light.png"
							unoptimized
							width={183}
						/>
					</Link>
				</div>
				<div className="flex lg:hidden">
					<button
						className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
						onClick={() => setMobileMenuOpen(true)}
						type="button"
					>
						<span className="sr-only">Open main menu</span>
						<Bars3Icon aria-hidden="true" className="h-6 w-6" />
					</button>
				</div>
				<div className="hidden lg:flex lg:gap-x-12">
					{navigation.map((item) => (
						<a
							className="font-semibold text-gray-900 text-sm leading-6"
							href={item.href}
							key={item.name}
							target={item.external ? "_blank" : "_self"}
						>
							{item.name}
						</a>
					))}
				</div>
				<div className="hidden lg:flex lg:flex-1 lg:justify-end">
					{loggedIn ? (
						<Link
							className="font-semibold text-gray-900 text-sm leading-6"
							href="/dashboard"
						>
							Get Started <span aria-hidden="true">&rarr;</span>
						</Link>
					) : (
						<Link
							className="font-semibold text-gray-900 text-sm leading-6"
							href="/login"
						>
							Log in <span aria-hidden="true">&rarr;</span>
						</Link>
					)}
				</div>
			</nav>
			<Dialog
				as="div"
				className="lg:hidden"
				onClose={setMobileMenuOpen}
				open={mobileMenuOpen}
			>
				<div className="fixed inset-0 z-50" />
				<Dialog.Panel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
					<div className="flex items-center justify-between">
						<Link className="-m-1.5 p-1.5" href="/">
							<Image
								alt="TEA Platform Logo"
								className="h-12 w-auto"
								height={48}
								priority
								src="/images/logos/tea-logo-full-light.png"
								unoptimized
								width={183}
							/>
						</Link>
						<button
							className="-m-2.5 rounded-md p-2.5 text-gray-700"
							onClick={() => setMobileMenuOpen(false)}
							type="button"
						>
							<span className="sr-only">Close menu</span>
							<XMarkIcon aria-hidden="true" className="h-6 w-6" />
						</button>
					</div>
					<div className="mt-6 flow-root">
						<div className="-my-6 divide-y divide-gray-500/10">
							<div className="space-y-2 py-6">
								{navigation.map((item) => (
									<a
										className="-mx-3 block rounded-lg px-3 py-2 font-semibold text-base text-gray-900 leading-7 hover:bg-gray-50"
										href={item.href}
										key={item.name}
										target="_blank"
									>
										{item.name}
									</a>
								))}
							</div>
							<div className="py-6">
								<Link
									className="-mx-3 block rounded-lg px-3 py-2.5 font-semibold text-base text-gray-900 leading-7 hover:bg-gray-50"
									href="/login"
								>
									Log in
								</Link>
							</div>
						</div>
					</div>
				</Dialog.Panel>
			</Dialog>
		</header>
	);
}

export default Header;
