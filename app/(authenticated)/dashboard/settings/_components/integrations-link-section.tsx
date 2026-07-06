import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Settings-landing link-out to the Integrations page (`/dashboard/settings/
 * integrations`, shipped in PR #851). That page has no other entry point —
 * this section is the fix for users only being able to reach it by typing
 * the URL. Scope is deliberately a link-out only (Chris's G1 ruling): the
 * full integrations manager stays on its own page, and this does not add a
 * dashboard-nav entry.
 */
export function IntegrationsLinkSection() {
	return (
		<div
			className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8"
			data-testid="integrations-link-section"
		>
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Integrations
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Manage machine clients and API tokens for this account.
				</p>
			</div>

			<div className="md:col-span-2">
				<Button asChild variant="outline">
					<Link href="/dashboard/settings/integrations">
						Manage integrations
					</Link>
				</Button>
			</div>
		</div>
	);
}
