import { redirect } from "next/navigation";
import { type TrashedCase, TrashList } from "@/components/cases/trash-list";
import PageHeading from "@/components/ui/page-heading";
import { Separator } from "@/components/ui/separator";
import { validateSession } from "@/lib/auth/validate-session";
import { calculateDaysRemaining, TRASH_RETENTION_DAYS } from "@/lib/constants";

async function fetchTrashedCases(userId: string): Promise<TrashedCase[]> {
	const { prismaNew } = await import("@/lib/prisma");

	const trashedCases = await prismaNew.assuranceCase.findMany({
		where: {
			createdById: userId,
			deletedAt: { not: null },
		},
		select: {
			id: true,
			name: true,
			description: true,
			createdAt: true,
			deletedAt: true,
		},
		orderBy: {
			deletedAt: "desc",
		},
	});

	return trashedCases.map((caseItem) => {
		const deletedAt = caseItem.deletedAt as Date;

		return {
			id: caseItem.id,
			name: caseItem.name,
			description: caseItem.description,
			createdAt: caseItem.createdAt.toISOString(),
			deletedAt: deletedAt.toISOString(),
			daysRemaining: calculateDaysRemaining(deletedAt),
		};
	});
}

async function TrashPage() {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const trashedCases = await fetchTrashedCases(session.userId);

	return (
		<div className="min-h-screen space-y-4 p-8">
			<PageHeading
				description={`Deleted cases are kept for ${TRASH_RETENTION_DAYS} days before being permanently removed`}
				title="Trash"
			/>
			<Separator />
			<TrashList cases={trashedCases} />
		</div>
	);
}

export default TrashPage;
