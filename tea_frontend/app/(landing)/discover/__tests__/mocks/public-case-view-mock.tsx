import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

			<button aria-label="Create case study" onClick={handleCreateCaseStudy}>
				Create Case Study
			</button>

			{successMessage && (
				<div aria-live="polite" role="alert">
					{successMessage}
				</div>
			)}

			{showCreateModal && (
				<div aria-labelledby="case-study-modal-title" role="dialog">
					<div>
						<h2 id="case-study-modal-title">Create Case Study</h2>
						<form aria-label="Case study form" onSubmit={handleSubmitCaseStudy}>
							<label>
								Title
								<input aria-label="Title" name="title" required type="text" />
							</label>
							<label>
								Description
								<textarea aria-label="Description" name="description" />
							</label>
							<button aria-label="Create" type="submit">
								Create
							</button>
							<button
								aria-label="Close modal"
								onClick={() => setShowCreateModal(false)}
								type="button"
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
