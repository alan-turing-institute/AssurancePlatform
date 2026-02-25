import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isTeamAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TeamSettingsForm } from "./_components/team-settings-form";

type TeamSettingsPageProps = {
	params: Promise<{ id: string }>;
};

export default async function TeamSettingsPage({
	params,
}: TeamSettingsPageProps) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect("/login");
	}

	const { id } = await params;

	// Only admins can access team settings
	const hasAdminAccess = await isTeamAdmin(session.user.id, id);
	if (!hasAdminAccess) {
		notFound();
	}

	const team = await prisma.team.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			slug: true,
			description: true,
		},
	});

	if (!team) {
		notFound();
	}

	return (
		<div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
			<TeamSettingsForm team={team} />
		</div>
	);
}
