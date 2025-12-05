"use client";

import { Settings, Users } from "lucide-react";
import Link from "next/link";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type TeamCardProps = {
	team: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		_count?: {
			members: number;
		};
		role?: string;
	};
};

export function TeamCard({ team }: TeamCardProps) {
	const memberCount = team._count?.members ?? 0;
	const isAdmin = team.role === "ADMIN" || team.role === "OWNER";

	return (
		<div className="group relative">
			<Link href={`/dashboard/teams/${team.id}`}>
				<Card className="flex h-full min-h-[200px] flex-col items-start justify-between transition-all group-hover:bg-indigo-500/5">
					<CardHeader className="w-full">
						<div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg border border-indigo-400 bg-indigo-500 font-medium text-lg text-white">
							{team.name.charAt(0).toUpperCase()}
						</div>
						<CardTitle className="text-lg">{team.name}</CardTitle>
						{team.description && (
							<CardDescription className="line-clamp-2">
								{team.description}
							</CardDescription>
						)}
					</CardHeader>
					<CardFooter className="flex w-full items-center justify-between text-gray-500 text-sm dark:text-gray-300">
						<div className="flex items-center gap-1">
							<Users className="h-4 w-4" />
							<span>
								{memberCount} {memberCount === 1 ? "member" : "members"}
							</span>
						</div>
						{isAdmin && (
							<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700 text-xs dark:bg-indigo-900/30 dark:text-indigo-300">
								Admin
							</span>
						)}
					</CardFooter>
				</Card>
			</Link>
			{isAdmin && (
				<Link
					className="absolute top-4 right-4 z-50 hidden rounded-md bg-slate-200 p-2 shadow-lg group-hover:block dark:bg-slate-700"
					href={`/dashboard/teams/${team.id}/settings`}
				>
					<Settings className="h-4 w-4" />
				</Link>
			)}
		</div>
	);
}
