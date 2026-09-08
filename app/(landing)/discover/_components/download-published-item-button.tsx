"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadPublishedItemButtonProps {
	content: string;
	title: string;
}

/**
 * Downloads a published item's frozen snapshot as a `.json` file — the
 * client-side half of "download/JSON access to the snapshot from the public
 * page" (ADR 0003 item 3). `content` is the already-stringified snapshot
 * JSON from `transformPublishableItemDetailForApi`.
 */
const DownloadPublishedItemButton = ({
	content,
	title,
}: DownloadPublishedItemButtonProps) => {
	const downloadJson = () => {
		try {
			const jsonData = JSON.parse(content);
			const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);

			const a = document.createElement("a");
			a.href = url;
			a.download = `${title.replace(/\s+/g, "_")}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (_error) {
			// Silently handle download errors — the same discipline as the
			// component this replaces (`download-case-button.tsx`).
		}
	};

	return (
		<div className="mt-4 flex shrink-0 items-center gap-x-4">
			<Button onClick={downloadJson} variant="default">
				Download JSON
				<DownloadIcon className="ml-2 size-4" />
			</Button>
		</div>
	);
};

export default DownloadPublishedItemButton;
