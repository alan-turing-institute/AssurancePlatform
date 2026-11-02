import type { PublishableItemDetailResponse } from "@/lib/services/discover-transforms";
import DownloadPublishedItemButton from "./download-published-item-button";
import UsePatternButton from "./use-pattern-button";

interface FrozenSnapshotSectionProps {
	item: PublishableItemDetailResponse;
}

/**
 * The detail page's snapshot section: the download of the frozen snapshot
 * and, for a published pattern only, "Use this pattern" beside it.
 */
const FrozenSnapshotSection = ({ item }: FrozenSnapshotSectionProps) => {
	const isPattern = item.type === "ARGUMENT_PATTERN";

	return (
		<div className="pt-6">
			<h3 className="font-semibold text-foreground text-lg">Frozen snapshot</h3>
			<p className="mt-2 text-sm">
				Download the full, point-in-time snapshot published for this item,
				including its argument structure.
				{isPattern &&
					" You can also start a new case from a copy of this pattern."}
			</p>
			<div className="flex flex-wrap items-start gap-x-4">
				<DownloadPublishedItemButton
					content={JSON.stringify(item.content)}
					title={item.title}
				/>
				{isPattern && (
					<UsePatternButton
						description={item.description ?? ""}
						slug={item.slug}
						title={item.title}
					/>
				)}
			</div>
		</div>
	);
};

export default FrozenSnapshotSection;
