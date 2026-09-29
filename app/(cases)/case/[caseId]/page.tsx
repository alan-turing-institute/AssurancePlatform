import type { Metadata } from "next";
import CaseContainer from "@/components/cases/case-container";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { validateSession } from "@/lib/auth/validate-session";
import { getCaseNameForViewer } from "@/lib/services/case-fetch-service";

/**
 * Generic, disclosure-safe metadata returned whenever the viewer's identity
 * or their access to the case cannot be established — no session, no VIEW
 * grant, a missing case, or a trashed one (AP-QA-012). Byte-identical in
 * every one of those cases, so none of them can be distinguished from the
 * response alone.
 */
const GENERIC_CASE_METADATA: Metadata = {
	title: "Assurance Case | TEA Platform",
};

export async function generateMetadata({
	params,
}: {
	params: Promise<{ caseId: string }>;
}): Promise<Metadata> {
	const { caseId } = await params;

	const session = await validateSession();
	if (!session) {
		return GENERIC_CASE_METADATA;
	}

	const name = await getCaseNameForViewer(session.userId, caseId);
	if (name === null) {
		return GENERIC_CASE_METADATA;
	}

	return { title: `${name} | TEA Platform` };
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
