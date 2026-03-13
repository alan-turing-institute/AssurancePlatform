"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface DescriptionCardProps {
	description: string;
	href: string;
	icon?: ReactNode;
	title: string;
}

export function DescriptionCard({
	icon,
	title,
	description,
	href,
}: DescriptionCardProps) {
	const isExternal = href.startsWith("http") || href.endsWith(".pdf");

	const content = (
		<div className="nextra-card group flex flex-col justify-start overflow-hidden rounded-lg border border-border text-current no-underline transition-all duration-200 hover:border-border hover:shadow-lg">
			<div className="flex items-start gap-3 p-4">
				{icon && <span className="text-muted-foreground">{icon}</span>}
				<div className="flex flex-col gap-1">
					<span className="flex items-center gap-1 font-semibold text-foreground group-hover:text-foreground">
						{title}
						{isExternal ? (
							<>
								<ExternalLink
									aria-hidden="true"
									className="h-3.5 w-3.5 shrink-0"
								/>
								<span className="sr-only">(opens in new tab)</span>
							</>
						) : (
							<span className="inline-block transition-transform group-hover:translate-x-0.5">
								→
							</span>
						)}
					</span>
					<span className="text-muted-foreground text-sm">{description}</span>
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

interface DescriptionCardsProps {
	children: ReactNode;
}

export function DescriptionCards({ children }: DescriptionCardsProps) {
	return (
		<div className="nextra-cards mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{children}
		</div>
	);
}
