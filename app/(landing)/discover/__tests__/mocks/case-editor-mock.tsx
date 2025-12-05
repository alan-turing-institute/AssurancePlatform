import { useState } from "react";
import type { AssuranceCase } from "@/types/domain";

type CaseEditorMockProps = {
	caseData: AssuranceCase;
};

export const CaseEditorMock = ({ caseData }: CaseEditorMockProps) => {
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isPublished, setIsPublished] = useState(caseData.published);
	const [publicDescription, setPublicDescription] = useState(
		caseData.description || ""
	);
	const [message, setMessage] = useState<string | null>(null);

	const handleSaveSettings = async () => {
		try {
			const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
			const response = await fetch(`${apiUrl}/api/cases/${caseData.id}/`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Token mock-jwt-token",
				},
				body: JSON.stringify({
					...caseData,
					published: isPublished,
					public_description: publicDescription,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to publish case");
			}

			// Show success message
			const successMessage = isPublished
				? "Case published successfully"
				: "Case unpublished successfully";

			setMessage(successMessage);
			setIsSettingsOpen(false);

			// Clear message after a delay (optional - to mimic real behavior)
			setTimeout(() => setMessage(null), 5000);
		} catch (error) {
			setMessage((error as Error).message);
		}
	};

	return (
		<div>
			<h1>{caseData.name}</h1>
			<button
				aria-label="Settings"
				onClick={() => setIsSettingsOpen(true)}
				type="button"
			>
				Settings
			</button>

			{message && <div>{message}</div>}

			{isSettingsOpen && (
				<div role="dialog">
					<h2>Case Settings</h2>

					<label>
						<input
							aria-checked={isPublished}
							aria-label="Publish case"
							checked={isPublished}
							onChange={(e) => setIsPublished(e.target.checked)}
							role="switch"
							type="checkbox"
						/>
						Publish Case
					</label>

					<label>
						Public Description
						<textarea
							aria-label="Public description"
							onChange={(e) => setPublicDescription(e.target.value)}
							value={publicDescription}
						/>
					</label>

					<button aria-label="Save" onClick={handleSaveSettings} type="button">
						Save
					</button>
				</div>
			)}
		</div>
	);
};
