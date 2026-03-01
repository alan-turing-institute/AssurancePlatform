import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { InviteAcceptCard } from "./_components/invite-accept-card";

export function generateMetadata(): Metadata {
	return {
		title: "Accept Invitation",
		description: "Accept an invitation to collaborate on an assurance case",
	};
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AcceptInvitePageProps = {
	params: Promise<{ token: string }>;
};

export default async function AcceptInvitePage({
	params,
}: AcceptInvitePageProps) {
	const { token } = await params;

	if (!UUID_RE.test(token)) {
		notFound();
	}

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect(`/login?callbackUrl=/invites/${token}`);
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<InviteAcceptCard token={token} />
		</div>
	);
}
