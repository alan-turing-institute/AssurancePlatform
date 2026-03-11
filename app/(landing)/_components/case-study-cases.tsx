import CaseStudyCaseItem from "./case-study-case-item";

type CaseStudyCasesProps = {
	assuranceCaseIds: string[];
};

const CaseStudyCases = ({ assuranceCaseIds }: CaseStudyCasesProps) => {
	if (assuranceCaseIds.length > 0) {
		return (
			<>
				<h3 className="font-semibold text-foreground text-lg">
					Related Assurance Cases
				</h3>
				<ul className="mt-8 mb-24 divide-y divide-border overflow-hidden bg-background shadow-xs ring-1 ring-border/50 sm:rounded-xl">
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
