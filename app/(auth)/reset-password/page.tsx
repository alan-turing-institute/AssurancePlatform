import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/reset-password-form";

function ResetPasswordContent() {
	return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
	return (
		<div className="flex min-h-screen flex-1">
			<div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:flex-none lg:px-20 xl:px-24">
				<Suspense
					fallback={
						<div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center lg:w-96">
							<div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
							<p className="mt-4 text-foreground text-sm">Loading...</p>
						</div>
					}
				>
					<ResetPasswordContent />
				</Suspense>
				<div className="my-8 flex items-center justify-center">
					<Link
						className="flex items-center justify-start text-muted-foreground text-sm hover:text-indigo-500"
						href={"/"}
					>
						Back to homepage
					</Link>
				</div>
			</div>
			<div className="relative hidden w-1/2 lg:block">
				<Image
					alt="Assurance platform illustration"
					className="absolute inset-0 h-full w-full object-cover"
					fill
					sizes="50vw"
					src="/images/assurance-alt.jpg"
				/>
			</div>
		</div>
	);
}
