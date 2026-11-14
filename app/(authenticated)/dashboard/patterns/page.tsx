import { Shapes } from "lucide-react";
import { redirect } from "next/navigation";
import { fetchUserPatterns } from "@/actions/case-kind";
import CaseList from "@/components/cases/case-list";
import { EmptyState } from "@/components/ui/empty-state";
import { validateSession } from "@/lib/auth/validate-session";

const HOW_TO_MAKE_A_PATTERN =
	"To make a pattern, use the new case dialog to start a blank pattern, or open one of your cases and choose Convert to pattern in its toolbar menu.";

const MyPatternsPage = async () => {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const patterns = await fetchUserPatterns();
	if (patterns == null) {
		redirect("/login");
	}

	if (patterns.length === 0) {
		return (
			<EmptyState
				icon={Shapes}
				message={HOW_TO_MAKE_A_PATTERN}
				title="No patterns yet"
			/>
		);
	}

	return (
		<>
			<p className="px-4 pt-6 text-muted-foreground text-sm sm:px-6 lg:px-8">
				{HOW_TO_MAKE_A_PATTERN}
			</p>
			<CaseList assuranceCases={patterns} />
		</>
	);
};

export default MyPatternsPage;
