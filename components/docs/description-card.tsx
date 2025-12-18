"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type DescriptionCardProps = {
	icon?: ReactNode;
	title: string;
	description: string;
	href: string;
};

export function DescriptionCard({
	icon,
	title,
	description,
	href,
}: DescriptionCardProps) {
	const isExternal = href.startsWith("http") || href.endsWith(".pdf");

	const content = (
		<div className="nextra-card group flex flex-col justify-start overflow-hidden rounded-lg border border-gray-200 text-current no-underline transition-all duration-200 hover:border-gray-300 hover:shadow-gray-100 hover:shadow-lg dark:border-neutral-700 dark:hover:border-neutral-500 dark:hover:shadow-none">
			<div className="flex items-start gap-3 p-4">
				{icon && (
					<span className="text-gray-400 dark:text-neutral-500">{icon}</span>
				)}
				<div className="flex flex-col gap-1">
					<span className="font-semibold text-gray-700 group-hover:text-gray-900 dark:text-neutral-200 dark:group-hover:text-neutral-50">
						{title}
						<span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
							→
						</span>
					</span>
					<span className="text-gray-500 text-sm dark:text-neutral-400">
						{description}
					</span>
				</div>
			</div>
		</div>
	);

	if (isExternal) {
		return (
			<a href={href} rel="noopener noreferrer" target="_blank">
				{content}
			</a>
		);
	}

	return <Link href={href}>{content}</Link>;
}

type DescriptionCardsProps = {
	children: ReactNode;
};

export function DescriptionCards({ children }: DescriptionCardsProps) {
	return (
		<div className="nextra-cards mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{children}
		</div>
	);
}
