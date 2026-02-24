import { redirect } from "next/navigation";
import { fetchAssuranceCases } from "@/actions/assurance-cases";
import { ensureUserHasDemoCase } from "@/actions/demo-case";
import { fetchCurrentUser } from "@/actions/users";
import CaseList from "@/components/cases/case-list";
import NoCasesFound from "@/components/cases/no-cases-found";
import CheckMigrationNotice from "@/components/check-migration-notice";
import CheckUserEmail from "@/components/check-user-email";
import CheckTour from "@/components/common/check-tour";
import { validateSession } from "@/lib/auth/validate-session";

const Dashboard = async () => {
	// Validate session (supports both JWT-only and legacy modes)
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	// Fetch current logged in user
	const currentUser = await fetchCurrentUser();
	if (currentUser == null) {
		redirect("/login");
	}

	// Ensure demo case exists (idempotent, runs before fetching cases)
	await ensureUserHasDemoCase();

	// Fetch cases for current logged in user
	const assuranceCases = await fetchAssuranceCases();
	if (assuranceCases == null) {
		redirect("/login");
	}

	return (
		<>
			<CheckMigrationNotice user={currentUser} />
			<CheckUserEmail user={currentUser} />
			<CheckTour
				completedTours={currentUser.completedTours ?? []}
				tourId="dashboard"
			/>
			{assuranceCases.length === 0 ? (
				<NoCasesFound
					message={"Get started by creating your own assurance case."}
				/>
			) : (
				<CaseList assuranceCases={assuranceCases} showCreate />
			)}
		</>
	);
};

export default Dashboard;
