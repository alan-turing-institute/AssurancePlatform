"use client";

import { MoveRightIcon } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
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
	const { data } = useSession();
	const [assuranceCasesList, setAssuranceCasesList] = useState<AssuranceCase[]>(
		[]
	);

	useEffect(() => {
		const getCases = async () => {
			// if (published) {
			//   // Fetch each selected assurance case and update list
			//   const publishedCases = await Promise.all(
			//     selectedAssuranceCases.map(async (assuranceCaseId) => {
			//       return await fetchPublishedAssuranceCaseId(assuranceCaseId)
			//     })
			//   )
			//   setAssuranceCasesList(publishedCases.filter(Boolean)) // Remove any undefined/null values
			// } else {
			//   // Fetch all cases when not published
			//   // const allCases = await fetchAssuranceCases(data?.key!!)
			//   const allCases = await fetchPublishedAssuranceCases(data?.key!!)
			//   console.log(allCases)
			//   setAssuranceCasesList(allCases)
			// }
			const response = await fetch("/api/published-assurance-cases", {
				headers: {
					Authorization: `Token ${data?.key}`,
				},
			});
			if (response.ok) {
				const allCases = await response.json();
				setAssuranceCasesList(allCases);
			}
		};

		getCases();

		// if (selectedAssuranceCases.length > 0 || !published) {
		//   getCases()
		// }
	}, [data?.key]);

	const handleCaseSelect = (assuranceCaseId: number) => {
		// Toggle the case in selectedAssuranceCases array
		setSelectedAssuranceCases((prevSelected: number[]) => {
			if (prevSelected.includes(assuranceCaseId)) {
				return prevSelected.filter((id: number) => id !== assuranceCaseId); // Remove it
			}
			return [...prevSelected, assuranceCaseId]; // Add it
		});
	};

	return (
		<>
			{assuranceCasesList.length === 0 && (
				// <p>No cases found. <Link href={'/dashboard'} className='text-violet-500 inline-flex justify-start items-center gap-2'>Create a New Assurance Case <MoveRightIcon className='size-4' /></Link></p>
				<div className="text-center">
					<h3 className="mt-2 font-semibold text-base text-foreground">
						No Published Assurance Cases Found
					</h3>
					<p className="mt-1 text-gray-500 text-sm">
						You need to publish an assurance case first.
					</p>
					<div className="mt-6">
						<Link
							className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
							href={"/dashboard"}
						>
							See Cases
							<MoveRightIcon aria-hidden="true" className="ml-2 size-4" />
						</Link>
					</div>
				</div>
			)}
			{assuranceCasesList.length > 0 && (
				<div className="mt-4">
					<ScrollArea className="h-72 w-full">
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
											onCheckedChange={() => handleCaseSelect(assuranceCase.id)}
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
