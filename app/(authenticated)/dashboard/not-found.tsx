import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
	return (
		<main className="grid min-h-[60vh] place-items-center px-6 py-24">
			<div className="text-center">
				<p className="font-semibold text-base text-primary">404</p>
				<h1 className="mt-4 font-semibold text-3xl text-foreground tracking-tight">
					Page not found
				</h1>
				<p className="mt-4 text-muted-foreground text-sm">
					Sorry, we couldn't find the page you're looking for.
				</p>
				<div className="mt-6">
					<Button asChild>
						<Link href="/dashboard">Back to dashboard</Link>
					</Button>
				</div>
			</div>
		</main>
	);
}
