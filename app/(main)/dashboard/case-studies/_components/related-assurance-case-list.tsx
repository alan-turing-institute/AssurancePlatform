"use client";

import { InfoIcon, MoveRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
	AssuranceCase,
	RelatedAssuranceCaseListProps,
} from "@/types/domain";

const RelatedAssuranceCaseList = ({
	selectedAssuranceCases,
	setSelectedAssuranceCases,
}: Omit<RelatedAssuranceCaseListProps, "published">) => {
	const [assuranceCasesList, setAssuranceCasesList] = useState<AssuranceCase[]>(
		[]
	);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const getCases = async () => {
			setIsLoading(true);
			try {
				// Fetch cases available for case study linking (owner's READY_TO_PUBLISH/PUBLISHED cases)
				const response = await fetch(
					"/api/published-assurance-cases?forCaseStudy=true"
				);
				if (response.ok) {
					const allCases = await response.json();
					setAssuranceCasesList(allCases);
				}
			} finally {
				setIsLoading(false);
			}
		};

		getCases();
	}, []);

	const handleCaseSelect = (assuranceCaseId: string) => {
		setSelectedAssuranceCases((prevSelected: string[]) => {
			if (prevSelected.includes(assuranceCaseId)) {
				return prevSelected.filter((id: string) => id !== assuranceCaseId);
			}
			return [...prevSelected, assuranceCaseId];
		});
	};

	if (isLoading) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				Loading available cases...
			</div>
		);
	}

	return (
		<>
			<Alert className="mb-4">
				<InfoIcon className="h-4 w-4" />
				<AlertDescription>
					Only your assurance cases marked as &quot;Ready to Publish&quot; or
					&quot;Published&quot; appear here. Can&apos;t see an assurance case?
					Mark it as &quot;Ready to Publish&quot; from the case editor.
				</AlertDescription>
			</Alert>

			{assuranceCasesList.length === 0 && (
				<div className="py-8 text-center">
					<h3 className="font-semibold text-base text-foreground">
						No Assurance Cases Ready to Link
					</h3>
					<p className="mt-1 text-muted-foreground text-sm">
						Mark an assurance case as &quot;Ready to Publish&quot; from the case
						editor to link it here.
					</p>
					<div className="mt-6">
						<Link
							className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
							href="/dashboard"
						>
							Go to Dashboard
							<MoveRightIcon aria-hidden="true" className="ml-2 size-4" />
						</Link>
					</div>
				</div>
			)}

			{assuranceCasesList.length > 0 && (
				<div className="mt-4">
					<ScrollArea
						className={`w-full ${assuranceCasesList.length > 4 ? "h-72" : "h-auto max-h-72"}`}
					>
						<div>
							{assuranceCasesList
								.sort((a: AssuranceCase, b: AssuranceCase) => {
									const aSelected = selectedAssuranceCases.includes(a.id);
									const bSelected = selectedAssuranceCases.includes(b.id);
									if (aSelected === bSelected) {
										return 0;
									}
									return aSelected ? -1 : 1;
								})
								.map((assuranceCase: AssuranceCase) => (
									<div
										className="mb-2 w-full rounded-md border transition-colors hover:bg-gray-50 dark:hover:bg-slate-900/50"
										key={assuranceCase.id}
									>
										<label
											className="flex cursor-pointer items-start space-x-3 p-4"
											htmlFor={`case-${assuranceCase.id}`}
										>
											<Checkbox
												checked={selectedAssuranceCases.includes(
													assuranceCase.id
												)}
												className="mt-1"
												id={`case-${assuranceCase.id}`}
												onCheckedChange={() =>
													handleCaseSelect(assuranceCase.id)
												}
											/>
											<div className="flex-1 text-sm">
												<p className="font-semibold">
													{assuranceCase.name || assuranceCase.title}
												</p>
												<p className="mt-1 text-muted-foreground">
													{assuranceCase.description !== null
														? assuranceCase.description
														: "No description"}
												</p>
											</div>
										</label>
									</div>
								))}
						</div>
					</ScrollArea>
				</div>
			)}
		</>
	);
};

export default RelatedAssuranceCaseList;
