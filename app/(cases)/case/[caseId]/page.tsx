import CaseContainer from "@/components/cases/case-container";

const AssuranceCasePage = async ({
	params,
}: {
	params: Promise<{ caseId: string }>;
}) => {
	const { caseId } = await params;

	return <CaseContainer caseId={caseId} />;
};

export default AssuranceCasePage;
