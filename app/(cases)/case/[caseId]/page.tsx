import CaseContainer from "@/components/cases/case-container";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const AssuranceCasePage = async ({
	params,
}: {
	params: Promise<{ caseId: string }>;
}) => {
	const { caseId } = await params;

	return (
		<ErrorBoundary
			fallback={
				<div className="flex min-h-screen items-center justify-center text-muted-foreground">
					<p>Case failed to load. Try refreshing.</p>
				</div>
			}
		>
			<CaseContainer caseId={caseId} />
		</ErrorBoundary>
	);
};

export default AssuranceCasePage;
