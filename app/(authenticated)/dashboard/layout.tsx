import { redirect } from "next/navigation";
import { Navbar } from "@/components/navigation/navbar";
import { validateSession } from "@/lib/auth/validate-session";
import { listUserTeams } from "@/lib/services/team-service";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const teamsResult = await listUserTeams(session.userId);

	return <Navbar teams={teamsResult.data ?? []}>{children}</Navbar>;
}
