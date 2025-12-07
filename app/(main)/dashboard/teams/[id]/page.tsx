import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { TeamMemberList } from "@/components/teams";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth-options";
import { prismaNew as prisma } from "@/lib/prisma";
import type { Prisma } from "@/src/generated/prisma";

type TeamDetailPageProps = {
	params: Promise<{ id: string }>;
};

type TeamWithMembers = Prisma.TeamGetPayload<{
	include: {
		members: {
			include: {
				user: {
					select: {
						id: true;
						username: true;
						email: true;
					};
				};
			};
		};
	};
}>;

async function getTeamWithMembers(
	teamId: string,
	userId: string
): Promise<(TeamWithMembers & { currentUserRole: string }) | null> {
	const team = await prisma.team.findUnique({
		where: { id: teamId },
		include: {
			members: {
				include: {
					user: {
						select: {
							id: true,
							username: true,
							email: true,
						},
					},
				},
				orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
			},
		},
	});

	if (!team) {
		return null;
	}

	// Check if current user is a member
	const membership = team.members.find((m) => m.user.id === userId);
	if (!membership) {
		return null;
	}

	return {
		...team,
		currentUserRole: membership.role,
	};
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect("/login");
	}

	const { id } = await params;
	const team = await getTeamWithMembers(id, session.user.id);

	if (!team) {
		notFound();
	}

	const isAdmin =
		team.currentUserRole === "ADMIN" || team.currentUserRole === "OWNER";

	return (
		<div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
			<div className="flex w-full items-center justify-between py-6">
				<div className="flex items-center gap-4">
					<Link href="/dashboard/teams">
						<Button size="icon" title="Back to teams" variant="ghost">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div>
						<h1 className="font-semibold text-2xl">{team.name}</h1>
						{team.description && (
							<p className="text-muted-foreground">{team.description}</p>
						)}
					</div>
				</div>
				{isAdmin && (
					<Link href={`/dashboard/teams/${team.id}/settings`}>
						<Button variant="outline">
							<Settings className="mr-2 h-4 w-4" />
							Settings
						</Button>
					</Link>
				)}
			</div>

			<div className="w-full max-w-4xl">
				<TeamMemberList
					currentUserId={session.user.id}
					currentUserRole={team.currentUserRole}
					members={team.members}
					teamId={team.id}
				/>
			</div>
		</div>
	);
}
