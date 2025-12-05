import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AssuranceCase, CaseStudy } from "@/types/domain";

type CaseStudyViewMockProps = {
	caseStudyId: number;
};

export const CaseStudyViewMock = ({ caseStudyId }: CaseStudyViewMockProps) => {
	const router = useRouter();
	const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
	const [linkedCases, setLinkedCases] = useState<AssuranceCase[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const apiUrl =
					process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
				// Fetch case study
				const studyResponse = await fetch(
					`${apiUrl}/api/public/case-studies/${caseStudyId}/`
				);
				const studyData = await studyResponse.json();
				setCaseStudy(studyData);

				// Fetch linked cases
				if (studyData.assurance_cases && studyData.assurance_cases.length > 0) {
					const casePromises = studyData.assurance_cases.map((caseId: number) =>
						fetch(`${apiUrl}/api/public/assurance-case/${caseId}/`).then(
							(res) => res.json()
						)
					);

					const cases = await Promise.all(casePromises);
					setLinkedCases(cases);
				}
			} catch (_error) {
				// Failed to fetch data
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [caseStudyId]);

	if (loading) {
		return <div>Loading...</div>;
	}

	if (!caseStudy) {
		return <div>Case study not found</div>;
	}

	return (
		<div>
			<h1>{caseStudy.title}</h1>
			<p>{caseStudy.description}</p>

			{linkedCases.length > 0 && (
				<div>
					<h2>Linked Cases</h2>
					{linkedCases.map((linkedCase) => (
						<button
							key={linkedCase.id}
							onClick={() => {
								router.push(`/discover/cases/${linkedCase.id}`);
							}}
							style={{
								cursor: "pointer",
								background: "none",
								border: "1px solid #ccc",
								padding: "10px",
								margin: "5px",
								width: "100%",
								textAlign: "left",
							}}
							type="button"
						>
							{linkedCase.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
};
