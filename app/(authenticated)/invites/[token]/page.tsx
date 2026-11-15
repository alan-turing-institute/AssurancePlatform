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

// An invitation token is 32 random bytes written as 64 hexadecimal characters.
const INVITE_TOKEN_RE = /^[0-9a-f]{64}$/i;

interface AcceptInvitePageProps {
	params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({
	params,
}: AcceptInvitePageProps) {
	const { token } = await params;

	if (!INVITE_TOKEN_RE.test(token)) {
		notFound();
	}

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect(`/login?redirect=/invites/${token}`);
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<InviteAcceptCard token={token} />
		</div>
	);
}
