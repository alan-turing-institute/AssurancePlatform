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
import { resolveFeatureImageSrc } from "@/lib/discover-image";
import { extractTextFromHtml } from "@/lib/sanitize-html";
import type { PublishableItemSummaryResponse } from "@/lib/services/discover-transforms";
import PublishableItemTypeBadge from "./publishable-item-type-badge";

interface PublishedItemsProps {
	items: PublishableItemSummaryResponse[];
}

/**
 * Discover index listing (ADR 0003 §4/§6) — renders published items from
 * their own frozen snapshot metadata only. Search/filter is client-side
 * over the already-fetched list, matching the previous case-studies index's
 * UX; the item shape underneath is now generic over `type` (ADR 0003 §5).
 */
function PublishedItems({ items }: PublishedItemsProps) {
	const [searchKeyword, setSearchKeyword] = useState("");
	const [selectedSector, setSelectedSector] = useState("");

	const sectors = Array.from(
		new Set(
			items
				.map((item: PublishableItemSummaryResponse) => item.sector)
				.filter((sector): sector is string => Boolean(sector))
		)
	);

	const filteredItems = items.filter(
		(item: PublishableItemSummaryResponse) =>
			(searchKeyword === "" ||
				item.title.toLowerCase().includes(searchKeyword.toLowerCase())) &&
			(selectedSector === "all" ||
				selectedSector === "" ||
				item.sector === selectedSector)
	);

	return (
		<>
			<div className="mx-auto mb-24 max-w-2xl text-foreground">
				<div className="flex items-center gap-4">
					<Input
						className="h-12 border-border bg-muted ring-offset-primary"
						onChange={(e) => setSearchKeyword(e.target.value)}
						placeholder="Search published items..."
						type="text"
						value={searchKeyword}
					/>

					<Select
						onValueChange={(value) => setSelectedSector(value)}
						value={selectedSector}
					>
						<SelectTrigger className="w-56 rounded-lg border border-border bg-muted shadow-xs focus:border-primary focus:ring-3 focus:ring-ring">
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
					{filteredItems.length > 0 ? (
						filteredItems.map((item: PublishableItemSummaryResponse) => (
							<article
								className="flex flex-col items-start justify-start"
								key={item.id}
							>
								<Link
									className="hover:cursor-pointer"
									href={`/discover/${item.slug}`}
								>
									<div className="relative w-full">
										<Image
											alt={`${item.title} featured image`}
											className="aspect-video w-full rounded-2xl bg-muted object-cover sm:aspect-2/1 lg:aspect-3/2"
											height={400}
											src={resolveFeatureImageSrc(item.featureImageUrl)}
											width={600}
										/>
										<div className="absolute inset-0 rounded-2xl ring-1 ring-border ring-inset" />
									</div>
								</Link>
								<div className="max-w-xl">
									<div className="mt-8 flex items-center gap-x-4 text-xs">
										<div className="flex items-center justify-start gap-2 text-muted-foreground">
											<CalendarDaysIcon className="size-4" />
											{formatShortDate(item.publishedAt)}
										</div>
										<PublishableItemTypeBadge type={item.type} />
										{item.sector && (
											<span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
												{item.sector}
											</span>
										)}
									</div>
									<div className="group relative">
										<h3 className="mt-3 font-semibold text-foreground text-lg/6 group-hover:text-muted-foreground">
											<Link href={`/discover/${item.slug}`}>{item.title}</Link>
										</h3>
										<div className="mt-5 line-clamp-3 text-muted-foreground text-sm/6">
											{extractTextFromHtml(item.description ?? "")}
										</div>
									</div>
									{item.authors && (
										<div className="relative mt-4 flex items-center gap-x-4">
											<div className="text-sm/6">
												<p className="font-semibold text-muted-foreground">
													<span>
														<span className="absolute inset-0" />
														Author(s): {item.authors}
													</span>
												</p>
											</div>
										</div>
									)}
								</div>
							</article>
						))
					) : (
						<p className="text-muted-foreground">
							No published items match your search criteria.
						</p>
					)}
				</div>
			</div>
		</>
	);
}

export default PublishedItems;
