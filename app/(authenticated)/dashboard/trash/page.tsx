import { redirect } from "next/navigation";
import {
	ArchivedCopiesList,
	type ArchivedCopy,
} from "@/components/cases/archived-copies-list";
import { type TrashedCase, TrashList } from "@/components/cases/trash-list";
import PageHeading from "@/components/ui/page-heading";
import { Separator } from "@/components/ui/separator";
import { validateSession } from "@/lib/auth/validate-session";
import { calculateDaysRemaining, TRASH_RETENTION_DAYS } from "@/lib/constants";

async function fetchTrashedCases(userId: string): Promise<TrashedCase[]> {
	const { prisma } = await import("@/lib/prisma");

	const trashedCases = await prisma.assuranceCase.findMany({
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

async function fetchArchivedCopies(userId: string): Promise<ArchivedCopy[]> {
	const { listArchivedCopies } = await import(
		"@/lib/services/case-trash-service"
	);
	const result = await listArchivedCopies(userId);
	return "error" in result ? [] : result.data;
}

async function TrashPage() {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const [trashedCases, archivedCopies] = await Promise.all([
		fetchTrashedCases(session.userId),
		fetchArchivedCopies(session.userId),
	]);

	return (
		<div className="min-h-screen space-y-4 p-8">
			<PageHeading
				description={`Deleted cases are kept for ${TRASH_RETENTION_DAYS} days before being permanently removed`}
				title="Trash"
			/>
			<Separator />
			<TrashList cases={trashedCases} />
			<ArchivedCopiesList copies={archivedCopies} />
		</div>
	);
}

export default TrashPage;
