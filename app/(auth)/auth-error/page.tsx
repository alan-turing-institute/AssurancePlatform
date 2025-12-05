import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900">
			<div className="w-full max-w-md space-y-8 text-center">
				<div>
					<h2 className="mt-6 font-bold text-3xl text-gray-900 tracking-tight dark:text-white">
						Authentication Error
					</h2>
					<p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
						We encountered an issue with your authentication session.
					</p>
				</div>

				<div className="mt-8 space-y-4">
					<div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
						<div className="flex">
							<div className="ml-3">
								<h3 className="font-medium text-sm text-yellow-800 dark:text-yellow-200">
									Session Issue Detected
								</h3>
								<div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
									<p>
										Your session appears to be in an invalid state. This can
										happen when:
									</p>
									<ul className="mt-2 list-inside list-disc space-y-1">
										<li>Your session has expired</li>
										<li>Cookies are disabled in your browser</li>
										<li>There's a mismatch between authentication services</li>
									</ul>
								</div>
							</div>
						</div>
					</div>

					<div className="space-y-3">
						<Link className="block" href="/login">
							<Button className="w-full" variant="default">
								Try Logging In Again
							</Button>
						</Link>

						<Link className="block" href="/">
							<Button className="w-full" variant="outline">
								Return to Homepage
							</Button>
						</Link>
					</div>

					<p className="text-gray-500 text-xs dark:text-gray-400">
						If this problem persists, please try clearing your browser cookies
						or contact support.
					</p>
				</div>
			</div>
		</div>
	);
}
