"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUnsupportedMarkerSwitch } from "@/hooks/use-unsupported-marker-switch";

interface UnsupportedMarkersFormProps {
	/** The stored setting when the page was drawn, or null when the account could not be read. */
	initialValue: boolean | null;
}

/**
 * The account-level switch for the case diagram's unsupported markers. It has
 * a section of its own because the Appearance section saves to the browser,
 * and this choice is saved to the account, so it follows the person to any
 * browser or computer. The case toolbar's Settings menu holds the same switch.
 */
export function UnsupportedMarkersForm({
	initialValue,
}: UnsupportedMarkersFormProps) {
	const [show, setShow] = useState<boolean | null>(initialValue);
	const unsupportedMarkers = useUnsupportedMarkerSwitch(show, setShow);

	return (
		<div
			className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8"
			data-testid="unsupported-markers-form"
		>
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Case diagram
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Choose what the case diagram marks for you. This is saved to your
					account, so it applies in every browser you sign in from.
				</p>
			</div>

			<div className="md:col-span-2">
				<div className="flex items-center gap-3">
					<Switch
						checked={unsupportedMarkers.checked}
						disabled={unsupportedMarkers.disabled}
						id="settings-show-unsupported-markers"
						onCheckedChange={unsupportedMarkers.onCheckedChange}
					/>
					<Label
						className="font-medium text-foreground text-sm"
						htmlFor="settings-show-unsupported-markers"
					>
						Show unsupported markers
					</Label>
				</div>
				<p className="mt-2 text-muted-foreground text-sm leading-6">
					A goal, strategy or claim with nothing beneath it carries a small
					Unsupported badge. The diagram works the badge out as you edit, and it
					never changes the status you set.
				</p>
			</div>
		</div>
	);
}
