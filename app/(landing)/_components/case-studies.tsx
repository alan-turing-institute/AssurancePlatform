"use client";

import { CalendarDaysIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { formatShortDate } from "@/lib/date";
import { extractTextFromHtml } from "@/lib/sanitize-html";
import { normalizeImageUrl } from "@/lib/utils";
import type { CaseStudiesProps, CaseStudy } from "@/types/domain";

function CaseStudies({ caseStudies }: CaseStudiesProps) {
	const [searchKeyword, setSearchKeyword] = useState("");
	const [selectedSector, setSelectedSector] = useState("");

	const sectors = Array.from(
		new Set(
			caseStudies
				.map((caseStudy: CaseStudy) => caseStudy.sector)
				.filter(Boolean)
		)
	);

	const filteredCaseStudies = caseStudies
		.filter((caseStudy: CaseStudy) => caseStudy.published)
		.filter(
			(caseStudy: CaseStudy) =>
				(searchKeyword === "" ||
					caseStudy.title
						.toLowerCase()
						.includes(searchKeyword.toLowerCase())) &&
				(selectedSector === "all" ||
					selectedSector === "" ||
					caseStudy.sector === selectedSector)
		);

	return (
		<>
			<div className="mx-auto mb-24 max-w-2xl text-black">
				<div className="flex items-center gap-4">
					{/* Search Bar */}
					<Input
						className="h-12 border-gray-100 bg-gray-100 ring-offset-indigo-500"
						onChange={(e) => setSearchKeyword(e.target.value)}
						placeholder="Search patterns..."
						type="text"
						value={searchKeyword}
					/>

					{/* Sector Filter */}
					<Select
						onValueChange={(value) => setSelectedSector(value)}
						value={selectedSector}
					>
						<SelectTrigger className="w-56 rounded-lg border border-gray-100 bg-gray-100 shadow-xs focus:border-indigo-500 focus:ring-3 focus:ring-indigo-200">
							<SelectValue placeholder="Select a sector" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Sectors</SelectItem>
							{sectors.map((sector: string) => (
								<SelectItem key={sector} value={sector}>
									{sector}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="mx-auto max-w-7xl px-6 pb-28 lg:px-8">
				<div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
					{filteredCaseStudies.length > 0 ? (
						filteredCaseStudies.map((caseStudy: CaseStudy) => (
							<article
								className="flex flex-col items-start justify-start"
								key={caseStudy.id}
							>
								<Link
									className="hover:cursor-pointer"
									href={`/discover/${caseStudy.id}`}
								>
									<div className="relative w-full">
										<Image
											alt={`${caseStudy.title} featured image`}
											className="aspect-video w-full rounded-2xl bg-gray-100 object-cover sm:aspect-2/1 lg:aspect-3/2"
											height={400}
											src={
												normalizeImageUrl(
													caseStudy.feature_image_url || caseStudy.featuredImage
												) ??
												"https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
											}
											width={600}
										/>
										<div className="absolute inset-0 rounded-2xl ring-1 ring-gray-900/10 ring-inset" />
									</div>
								</Link>
								<div className="max-w-xl">
									<div className="mt-8 flex items-center gap-x-4 text-xs">
										<div className="flex items-center justify-start gap-2 text-gray-500">
											<CalendarDaysIcon className="size-4" />
											{formatShortDate(caseStudy.publishedDate)}
										</div>
										<span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-700 text-xs">
											{caseStudy.sector}
										</span>
									</div>
									<div className="group relative">
										<h3 className="mt-3 font-semibold text-gray-900 text-lg/6 group-hover:text-gray-600">
											<Link href={`/discover/${caseStudy.id}`}>
												{caseStudy.title}
											</Link>
										</h3>
										<div className="mt-5 line-clamp-3 text-gray-600 text-sm/6">
											{extractTextFromHtml(caseStudy.description)}
										</div>
									</div>
									<div className="relative mt-4 flex items-center gap-x-4">
										{/* <img
                      alt=""
                      src={'https://avatars.githubusercontent.com/u/63010234?v=4'}
                      className="size-10 rounded-full bg-gray-100"
                    /> */}
										<div className="text-sm/6">
											<p className="font-semibold text-muted-foreground">
												<span>
													<span className="absolute inset-0" />
													Author(s): {caseStudy.authors}
												</span>
											</p>
											{/* <p className="text-gray-600">@ChrisBurrTuring</p> */}
										</div>
									</div>
								</div>
							</article>
						))
					) : (
						<p className="text-gray-600">
							No Case Studies match your search criteria.
						</p>
					)}
				</div>
			</div>
		</>
	);
}

export default CaseStudies;
