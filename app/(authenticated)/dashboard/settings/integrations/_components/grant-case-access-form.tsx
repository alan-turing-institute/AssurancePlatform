"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { fetchAdministrableCases } from "@/actions/assurance-cases";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { CaseGrantPermission } from "@/lib/schemas/integration";

interface CaseOption {
	id: string;
	name: string;
}

const PERMISSION_OPTIONS: Array<{
	label: string;
	value: CaseGrantPermission;
}> = [
	{ value: "VIEW", label: "Can view" },
	{ value: "COMMENT", label: "Can comment" },
	{ value: "EDIT", label: "Can edit" },
];

export interface GrantCaseAccessFormProps {
	/** caseIds the integration already has access to — excluded from the picker so re-granting the same case is never offered as a "fresh" option. */
	existingCaseIds: string[];
	/** The faithfully-mapped 409/404/network message from the most recent failed attempt, or `null`. */
	grantError: string | null;
	/** True while the parent's grant request is in flight. */
	granting: boolean;
	onCancel: () => void;
	onGrant: (
		caseId: string,
		permission: CaseGrantPermission
	) => Promise<boolean>;
}

/**
 * The inline "grant access to a case" form — rendered by `CaseAccessSection`
 * once "+ Grant access to a case…" is clicked. Its case options come from
 * `fetchAdministrableCases`, fetched when the form opens rather than whenever
 * the settings page loads, because nobody needs the list until then.
 *
 * The list holds the cases the grant route will accept: the ones the user
 * created and the ones shared with them at ADMIN, directly or through a team.
 * Patterns and trashed cases are not listed. The list is advisory: the grant
 * route checks ADMIN again, and its 404 (surfaced via `grantError`) covers a
 * case whose sharing changed after the list loaded.
 */
export function GrantCaseAccessForm({
	existingCaseIds,
	granting,
	grantError,
	onCancel,
	onGrant,
}: GrantCaseAccessFormProps) {
	const [cases, setCases] = useState<CaseOption[]>([]);
	const [casesLoading, setCasesLoading] = useState(true);
	const [selectedCaseId, setSelectedCaseId] = useState("");
	const [selectedPermission, setSelectedPermission] =
		useState<CaseGrantPermission>("VIEW");

	useEffect(() => {
		let cancelled = false;
		setCasesLoading(true);
		fetchAdministrableCases()
			.then((result) => {
				if (!cancelled) {
					setCases(result ?? []);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setCasesLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const availableCases = cases.filter((c) => !existingCaseIds.includes(c.id));

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (!selectedCaseId) {
			return;
		}
		await onGrant(selectedCaseId, selectedPermission);
	}

	return (
		<form
			className="space-y-3 rounded-md border border-border border-dashed p-3"
			onSubmit={handleSubmit}
		>
			{grantError && (
				<p className="text-destructive text-xs" role="alert">
					{grantError}
				</p>
			)}

			{casesLoading && (
				<p className="text-muted-foreground text-xs">Loading your cases…</p>
			)}

			{!casesLoading && cases.length === 0 && (
				<p className="text-muted-foreground text-xs">
					You don't administer any cases yet.
				</p>
			)}

			{!casesLoading && cases.length > 0 && availableCases.length === 0 && (
				<p className="text-muted-foreground text-xs">
					Every case you administer already has this integration granted.
				</p>
			)}

			{!casesLoading && availableCases.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					<Select onValueChange={setSelectedCaseId} value={selectedCaseId}>
						<SelectTrigger aria-label="Case" className="h-8 w-56 text-xs">
							<SelectValue placeholder="Choose a case…" />
						</SelectTrigger>
						<SelectContent>
							{availableCases.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(value) =>
							setSelectedPermission(value as CaseGrantPermission)
						}
						value={selectedPermission}
					>
						<SelectTrigger
							aria-label="Permission level"
							className="h-8 w-32 text-xs"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PERMISSION_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="flex items-center gap-2">
				<Button
					disabled={granting}
					onClick={onCancel}
					size="sm"
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button
					disabled={granting || !selectedCaseId || availableCases.length === 0}
					size="sm"
					type="submit"
				>
					{granting ? "Granting…" : "Grant access"}
				</Button>
			</div>
		</form>
	);
}
