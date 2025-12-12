import CaseStudyCaseItem from "./case-study-case-item";

type CaseStudyCasesProps = {
	assuranceCaseIds: string[];
};

const CaseStudyCases = ({ assuranceCaseIds }: CaseStudyCasesProps) => {
	if (assuranceCaseIds.length > 0) {
		return (
			<>
				<h3 className="font-semibold text-black text-lg">
					Related Assurance Cases
				</h3>
				<ul className="mt-8 mb-24 divide-y divide-gray-100 overflow-hidden bg-white shadow-xs ring-1 ring-gray-900/5 sm:rounded-xl">
					{assuranceCaseIds.map((assuranceCaseId) => (
						<CaseStudyCaseItem
							assuranceCaseId={assuranceCaseId}
							key={assuranceCaseId}
						/>
					))}
				</ul>
			</>
		);
	}

	return null;
};

export default CaseStudyCases;
