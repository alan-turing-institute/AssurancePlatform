import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { InviteAcceptCard } from "./_components/invite-accept-card";

type AcceptInvitePageProps = {
	params: Promise<{ token: string }>;
};

export default async function AcceptInvitePage({
	params,
}: AcceptInvitePageProps) {
	const { token } = await params;
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
