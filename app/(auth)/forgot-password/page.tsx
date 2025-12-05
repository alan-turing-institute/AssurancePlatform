import Image from "next/image";
import Link from "next/link";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
	return (
		<div className="flex min-h-screen flex-1">
			<div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:flex-none lg:px-20 xl:px-24">
				<ForgotPasswordForm />
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
