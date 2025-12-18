"use client";

import { ArrowRight, Clock, Lock } from "lucide-react";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ModuleStatus = "available" | "coming-soon" | "locked";

export type ModuleCardProps = {
	/** Module number (e.g., 1, 2, 3) */
	moduleNumber: number;
	/** Module title */
	title: string;
	/** Short description of the module */
	description: string;
	/** Estimated duration (e.g., "20-30 minutes") */
	duration?: string;
	/** URL to navigate to when clicked */
	href?: string;
	/** Module availability status */
	status?: ModuleStatus;
};

/**
 * ModuleCard - Display a curriculum module as an interactive card
 */
export const ModuleCard = ({
	moduleNumber,
	title,
	description,
	duration,
	href,
	status = "available",
}: ModuleCardProps): React.ReactNode => {
	const isAvailable = status === "available" && href;
	const isComingSoon = status === "coming-soon";
	const isLocked = status === "locked";

	const cardContent = (
		<Card
			className={cn(
				"group relative overflow-hidden transition-all duration-300",
				isAvailable && "cursor-pointer hover:border-primary/50 hover:shadow-md",
				(isComingSoon || isLocked) && "opacity-75"
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start gap-4">
					{/* Module number badge */}
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-lg text-primary">
						{moduleNumber}
					</div>
					<div className="flex-1">
						<CardTitle className="text-xl">{title}</CardTitle>
						<CardDescription className="mt-1.5 line-clamp-2">
							{description}
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent>
				<div className="flex items-center justify-end">
					{duration && (
						<div className="mr-auto flex items-center gap-1.5 text-muted-foreground text-sm">
							<Clock className="h-4 w-4" />
							<span>{duration}</span>
						</div>
					)}

					{isAvailable && (
						<div className="flex items-center gap-1 text-primary text-sm transition-transform group-hover:translate-x-1">
							<span>Start module</span>
							<ArrowRight className="h-4 w-4" />
						</div>
					)}

					{isComingSoon && (
						<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
							<Clock className="h-4 w-4" />
							<span>Coming soon</span>
						</div>
					)}

					{isLocked && (
						<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
							<Lock className="h-4 w-4" />
							<span>Complete previous modules</span>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);

	if (isAvailable && href) {
		return <Link href={href}>{cardContent}</Link>;
	}

	return cardContent;
};

export type ModuleGridProps = {
	children: React.ReactNode;
	className?: string;
};

/**
 * ModuleGrid - A responsive grid layout for module cards
 */
export const ModuleGrid = ({
	children,
	className,
}: ModuleGridProps): React.ReactNode => (
	<div
		className={cn(
			"mt-8 grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2",
			className
		)}
	>
		{children}
	</div>
);

export default ModuleCard;
