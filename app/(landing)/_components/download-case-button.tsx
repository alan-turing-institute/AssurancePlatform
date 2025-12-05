"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const DownloadCaseButton = ({
	content,
	title,
}: {
	content: string;
	title: string;
}) => {
	const downloadJSON = () => {
		try {
			// Parse the content string into a JSON object
			const jsonData = JSON.parse(content);

			// Convert JSON object to a Blob
			const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
				type: "application/json",
			});

			// Create a URL for the Blob
			const url = URL.createObjectURL(blob);

			// Create a temporary <a> element
			const a = document.createElement("a");
			a.href = url;
			a.download = `${title.replace(/\s+/g, "_")}.json`; // Set filename
			document.body.appendChild(a);

			// Trigger download
			a.click();

			// Clean up
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (_error) {
			// Silently handle download errors
		}
	};

	return (
		<div className="mt-4 flex shrink-0 items-center gap-x-4">
			<Button onClick={downloadJSON} variant="default">
				Download
				<DownloadIcon className="ml-2 size-4" />
			</Button>
		</div>
	);
};

export default DownloadCaseButton;
