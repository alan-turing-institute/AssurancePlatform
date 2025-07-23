import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssuranceCase } from "@/types/domain";

interface PublicCaseViewMockProps {
	caseId: number;
}

export const PublicCaseViewMock = ({ caseId }: PublicCaseViewMockProps) => {
	const router = useRouter();
	const [caseData, setCaseData] = useState<AssuranceCase | null>(null);
	const [loading, setLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");

	useEffect(() => {
		const fetchCase = async () => {
			try {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/public/assurance-case/${caseId}/`
				);
				const data = await response.json();
				setCaseData(data);
			} catch (_error) {
				// Handle error - in real implementation would set error state
			} finally {
				setLoading(false);
			}
		};

		fetchCase();
	}, [caseId]);

	const handleCreateCaseStudy = () => {
		setShowCreateModal(true);
	};

	const handleSubmitCaseStudy = async (e: React.FormEvent) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/`,
				{
					method: "POST",
					headers: {
						Authorization: "Token mock-jwt-token",
					},
					body: formData,
				}
			);

			if (response.ok) {
				const result = await response.json();
				setSuccessMessage("Case study created successfully");
				setShowCreateModal(false);
				// Use router.push instead of window.history.pushState
				router.push(`/dashboard/case-studies/${result.id}`);
			}
		} catch (_error) {
			// Handle error in real implementation
		}
	};

	if (loading) {
		return <div>Loading case...</div>;
	}

	if (!caseData) {
		return <div>Case not found</div>;
	}

	return (
		<div>
			<h1>{caseData.name}</h1>
			<p>{caseData.description}</p>

			<button onClick={handleCreateCaseStudy} aria-label="Create case study">
				Create Case Study
			</button>

			{successMessage && (
				<div role="alert" aria-live="polite">
					{successMessage}
				</div>
			)}

			{showCreateModal && (
				<div role="dialog" aria-labelledby="case-study-modal-title">
					<div>
						<h2 id="case-study-modal-title">Create Case Study</h2>
						<form onSubmit={handleSubmitCaseStudy} aria-label="Case study form">
							<label>
								Title
								<input type="text" name="title" aria-label="Title" required />
							</label>
							<label>
								Description
								<textarea name="description" aria-label="Description" />
							</label>
							<button type="submit" aria-label="Create">
								Create
							</button>
							<button
								type="button"
								onClick={() => setShowCreateModal(false)}
								aria-label="Close modal"
							>
								Cancel
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
