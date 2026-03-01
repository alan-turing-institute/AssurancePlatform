"use client";

import { ArrowUpTrayIcon } from "@heroicons/react/20/solid";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreateCaseModal, useImportModal } from "@/hooks/modal-hooks";
import { Input } from "../ui/input";
import CaseCard, { type CaseCardData } from "./case-card";

const SORT_STORAGE_KEY = "tea-case-sort";

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "updated";

const sortLabels: Record<SortOption, string> = {
	newest: "Newest first",
	oldest: "Oldest first",
	"name-asc": "Name (A\u2013Z)",
	"name-desc": "Name (Z\u2013A)",
	updated: "Last modified",
};

function getInitialSort(): SortOption {
	if (typeof window === "undefined") {
		return "newest";
	}
	const stored = localStorage.getItem(SORT_STORAGE_KEY);
	if (stored && stored in sortLabels) {
		return stored as SortOption;
	}
	return "newest";
}

function compareCases(
	a: CaseCardData,
	b: CaseCardData,
	sortBy: SortOption
): number {
	switch (sortBy) {
		case "newest":
			return (
				new Date(b.created_date ?? 0).getTime() -
				new Date(a.created_date ?? 0).getTime()
			);
		case "oldest":
			return (
				new Date(a.created_date ?? 0).getTime() -
				new Date(b.created_date ?? 0).getTime()
			);
		case "name-asc":
			return a.name.localeCompare(b.name);
		case "name-desc":
			return b.name.localeCompare(a.name);
		case "updated":
			return (
				new Date(b.updated_date ?? b.created_date ?? 0).getTime() -
				new Date(a.updated_date ?? a.created_date ?? 0).getTime()
			);
		default:
			return 0;
	}
}

type CaseListProps = {
	assuranceCases: CaseCardData[];
	showCreate?: boolean;
	className?: string;
};

const CaseList = ({ assuranceCases, showCreate = false }: CaseListProps) => {
	const createCaseModal = useCreateCaseModal();
	const importModal = useImportModal();

	const [searchTerm, setSearchTerm] = useState<string>("");
	const [sortBy, setSortBy] = useState<SortOption>(getInitialSort);

	const handleSortChange = (value: string) => {
		if (!(value in sortLabels)) {
			return;
		}
		const sort = value as SortOption;
		setSortBy(sort);
		localStorage.setItem(SORT_STORAGE_KEY, sort);
	};

	// Filter and sort cases - useMemo to avoid recalculating on every render
	const filteredCases = useMemo(() => {
		const searchTermLowerCase = searchTerm.toLowerCase().trim();

		// Filter by search term
		const filtered =
			searchTermLowerCase === ""
				? assuranceCases
				: assuranceCases.filter((ac) =>
						ac.name.toLowerCase().includes(searchTermLowerCase)
					);

		// Sort by selected option - spread to avoid mutation
		return [...filtered].sort((a, b) => compareCases(a, b, sortBy));
	}, [searchTerm, assuranceCases, sortBy]);

	return (
		<div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
			<div className="flex w-full items-start justify-between gap-6 py-6">
				<div
					className="w-2/3 md:w-1/3"
					data-testid="search-container"
					data-tour="case-filter"
				>
					<Input
						className="w-full"
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Filter by name..."
						type="text"
						value={searchTerm}
					/>
				</div>
				<div className="flex items-center gap-3">
					<Select defaultValue={sortBy} onValueChange={handleSortChange}>
						<SelectTrigger
							aria-label="Sort cases"
							className="w-[160px]"
							data-testid="sort-select"
							data-tour="case-sort"
						>
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							{(Object.entries(sortLabels) as [SortOption, string][]).map(
								([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								)
							)}
						</SelectContent>
					</Select>
					<Button
						data-tour="import-case"
						onClick={() => importModal.onOpen()}
						size="sm"
					>
						<ArrowUpTrayIcon
							aria-hidden="true"
							className="-ml-0.5 h-5 w-5 md:mr-1.5"
						/>
						<span className="hidden md:block">Import File</span>
					</Button>
				</div>
			</div>
			<div
				className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
				data-testid="case-list-grid"
			>
				{showCreate && (
					<Button
						className="group h-auto min-h-[420px] p-0"
						data-tour="create-case"
						onClick={() => createCaseModal.onOpen()}
						variant="ghost"
					>
						<Card className="flex h-full w-full items-center justify-center border-dashed transition-all group-hover:bg-primary/10">
							<CardContent className="flex flex-col items-center justify-center gap-2 py-20">
								<PlusCircleIcon className="group-hover:-translate-y-1 h-10 w-10 transition-all" />
								<div>
									<h4 className="mb-1 text-center text-xl">Create new case</h4>
									<p className="text-center text-foreground/70 text-sm">
										Get started with a new case.
									</p>
								</div>
							</CardContent>
						</Card>
					</Button>
				)}
				{filteredCases.map((assuranceCase) => (
					<CaseCard assuranceCase={assuranceCase} key={assuranceCase.id} />
				))}
			</div>
		</div>
	);
};

export default CaseList;
