import { redirect } from "next/navigation";
import { fetchSharedAssuranceCases } from "@/actions/assurance-cases";
import CaseList from "@/components/cases/case-list";
import NoCasesFound from "@/components/cases/no-cases-found";
import { validateSession } from "@/lib/auth/validate-session";

const SharedWithMePage = async () => {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const sharedAssuranceCases = await fetchSharedAssuranceCases("");

	// Handle null or empty array
	const cases = sharedAssuranceCases ?? [];

	return (
		<>
			{cases.length === 0 ? (
				<NoCasesFound message={"No cases shared with you yet."} shared />
			) : (
				<CaseList assuranceCases={cases} />
			)}
		</>
	);
};

export default SharedWithMePage;
