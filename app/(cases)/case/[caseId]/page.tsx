import type { Metadata } from "next";
import CaseContainer from "@/components/cases/case-container";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { prismaNew } from "@/lib/prisma";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ caseId: string }>;
}): Promise<Metadata> {
	const { caseId } = await params;
	const assuranceCase = await prismaNew.assuranceCase.findUnique({
		where: { id: caseId },
		select: { name: true },
	});
	return {
		title: assuranceCase
			? `${assuranceCase.name} | TEA Platform`
			: "Assurance Case | TEA Platform",
	};
}

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
