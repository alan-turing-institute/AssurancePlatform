import {
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import useStore from "@/store/store";

/**
 * What the share panel calls the thing it shares. The panel is opened from
 * the editor, so the case on screen is the one being shared; a pattern is
 * named as a pattern.
 */
export function useSharedItemName(): "case" | "pattern" {
	return useStore((state) =>
		state.assuranceCase?.kind === "PATTERN" ? "pattern" : "case"
	);
}

/** The share panel's title and one-line description, worded for a case or a pattern. */
export function SharingDialogHeader() {
	const itemName = useSharedItemName();

	return (
		<DialogHeader>
			<DialogTitle>
				{itemName === "pattern" ? "Share Pattern" : "Share Case"}
			</DialogTitle>
			<DialogDescription>
				{`Share this ${itemName} with individuals or teams`}
			</DialogDescription>
		</DialogHeader>
	);
}
