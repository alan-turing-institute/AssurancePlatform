import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/date";

interface ArchivedProps {
	/** The date the copy was archived, or `null`/`undefined` for a live copy — both render nothing. */
	archivedAt?: string | null;
}

/**
 * The "Archived" label shown on a Discover card for a copy that was kept
 * archived rather than removed when its case was trashed. Renders nothing
 * for a live copy.
 */
export function ArchivedBadge({ archivedAt }: ArchivedProps) {
	if (!archivedAt) {
		return null;
	}
	return <Badge variant="outline">Archived</Badge>;
}

/**
 * The "Archived on ‹date›" line shown on a Discover detail page for a copy
 * that was kept archived rather than removed when its case was trashed.
 * Renders nothing for a live copy.
 */
export function ArchivedOnNotice({ archivedAt }: ArchivedProps) {
	if (!archivedAt) {
		return null;
	}
	return (
		<p className="mt-2 text-muted-foreground text-sm">
			Archived on {formatShortDate(archivedAt)}. This case no longer receives
			updates.
		</p>
	);
}
