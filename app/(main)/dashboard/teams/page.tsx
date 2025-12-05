import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { TeamList } from "@/components/teams";
import { authOptions } from "@/lib/auth-options";
import { prismaNew as prisma } from "@/lib/prisma-new";

async function getTeamsForUser(userId: string) {
	const memberships = await prisma.teamMember.findMany({
		where: { userId },
		include: {
			team: {
				include: {
					_count: {
						select: { members: true },
					},
				},
			},
		},
		orderBy: {
			team: {
				name: "asc",
			},
		},
	});

	return memberships.map((m: (typeof memberships)[number]) => ({
		...m.team,
		role: m.role,
	}));
}

export default async function TeamsPage() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect("/login");
	}

	const teams = await getTeamsForUser(session.user.id);

	return <TeamList teams={teams} />;
}
