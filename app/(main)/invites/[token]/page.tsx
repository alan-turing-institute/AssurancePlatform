"use client";

import { CheckCircle, Loader, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type InviteResult = {
	success: boolean;
	error?: string;
	caseId?: string;
};

function SuccessContent({ caseId }: { caseId?: string }) {
	return (
		<>
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
					<CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
				</div>
				<CardTitle>Invite Accepted!</CardTitle>
				<CardDescription>
					You now have access to this assurance case
				</CardDescription>
			</CardHeader>
			<CardFooter className="justify-center">
				<Link href={`/case/${caseId}`}>
					<Button>View Case</Button>
				</Link>
			</CardFooter>
		</>
	);
}

function ErrorContent({ error }: { error?: string }) {
	return (
		<>
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					<XCircle className="h-10 w-10 text-destructive" />
				</div>
				<CardTitle>Unable to Accept Invite</CardTitle>
				<CardDescription>{error}</CardDescription>
			</CardHeader>
			<CardFooter className="justify-center">
				<Link href="/dashboard">
					<Button variant="outline">Go to Dashboard</Button>
				</Link>
			</CardFooter>
		</>
	);
}

function PendingContent({
	accepting,
	onAccept,
}: {
	accepting: boolean;
	onAccept: () => void;
}) {
	return (
		<>
			<CardHeader className="text-center">
				<CardTitle>You&apos;ve Been Invited!</CardTitle>
				<CardDescription>
					Someone has invited you to collaborate on an assurance case
				</CardDescription>
			</CardHeader>
			<CardContent className="text-center">
				<p className="text-muted-foreground text-sm">
					Click the button below to accept this invitation and gain access to
					the shared case.
				</p>
			</CardContent>
			<CardFooter className="justify-center">
				<Button disabled={accepting} onClick={onAccept}>
					{accepting ? (
						<>
							<Loader className="mr-2 h-4 w-4 animate-spin" />
							Accepting...
						</>
					) : (
						"Accept Invite"
					)}
				</Button>
			</CardFooter>
		</>
	);
}

function renderCardContent(
	result: InviteResult | null,
	accepting: boolean,
	onAccept: () => void
) {
	if (!result) {
		return <PendingContent accepting={accepting} onAccept={onAccept} />;
	}
	if (result.success) {
		return <SuccessContent caseId={result.caseId} />;
	}
	return <ErrorContent error={result.error} />;
}

export default function AcceptInvitePage() {
	const params = useParams();
	const router = useRouter();
	const { status } = useSession();
	const token = params.token as string;

	const [accepting, setAccepting] = useState(false);
	const [result, setResult] = useState<InviteResult | null>(null);

	const acceptInvite = async () => {
		setAccepting(true);

		try {
			const response = await fetch(`/api/invites/${token}/accept`, {
				method: "POST",
			});

			const data = await response.json();

			if (response.ok) {
				setResult({ success: true, caseId: data.case_id });
			} else {
				setResult({
					success: false,
					error: data.error || "Failed to accept invite",
				});
			}
		} catch (_error) {
			setResult({ success: false, error: "An error occurred" });
		} finally {
			setAccepting(false);
		}
	};

	useEffect(() => {
		if (status === "unauthenticated") {
			// Redirect to login with callback
			router.push(`/login?callbackUrl=/invites/${token}`);
		}
	}, [status, router, token]);

	if (status === "loading") {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader className="h-10 w-10 animate-spin" />
			</div>
		);
	}

	if (status === "unauthenticated") {
		return null;
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-md">
				{renderCardContent(result, accepting, acceptInvite)}
			</Card>
		</div>
	);
}
