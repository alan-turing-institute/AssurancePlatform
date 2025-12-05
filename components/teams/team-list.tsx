"use client";

import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
import { TeamCard } from "./team-card";

type Team = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	_count?: {
		members: number;
	};
	role?: string;
};

type TeamListProps = {
	teams: Team[];
};

export function TeamList({ teams }: TeamListProps) {
	const createTeamModal = useCreateTeamModal();
	const [searchTerm, setSearchTerm] = useState("");
	const [filteredTeams, setFilteredTeams] = useState(teams);

	useEffect(() => {
		const searchTermLowerCase = searchTerm.toLowerCase();
		if (searchTerm.trim() === "") {
			setFilteredTeams(teams);
		} else {
			const filtered = teams.filter((team) =>
				team.name.toLowerCase().includes(searchTermLowerCase)
			);
			setFilteredTeams(filtered);
		}
	}, [searchTerm, teams]);

	return (
		<div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
			<div className="flex w-full items-start justify-between gap-6 py-6">
				<div className="w-2/3 md:w-1/3">
					<Input
						className="w-full"
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Filter by name..."
						type="text"
						value={searchTerm}
					/>
				</div>
				<div className="flex w-1/3 items-end justify-end">
					<button
						className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
						onClick={() => createTeamModal.onOpen()}
						type="button"
					>
						<PlusCircleIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
						<span className="hidden md:block">New Team</span>
					</button>
				</div>
			</div>
			<div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				<button
					className="group min-h-[200px]"
					onClick={() => createTeamModal.onOpen()}
					type="button"
				>
					<Card className="flex h-full items-center justify-center border-dashed transition-all group-hover:bg-indigo-500/10">
						<CardContent className="flex flex-col items-center justify-center gap-2 py-10">
							<PlusCircleIcon className="group-hover:-translate-y-1 h-10 w-10 transition-all" />
							<div>
								<h4 className="mb-1 text-center text-xl">Create new team</h4>
								<p className="text-center text-foreground/70 text-sm">
									Collaborate with others.
								</p>
							</div>
						</CardContent>
					</Card>
				</button>
				{filteredTeams.map((team) => (
					<TeamCard key={team.id} team={team} />
				))}
			</div>
		</div>
	);
}
