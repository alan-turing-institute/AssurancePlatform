"use client";

import { PanelRight } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCasePanelSlot } from "@/hooks/use-case-panel-slot";
import type { CasePanelRegistration } from "@/lib/plugins/slots/index";
import useStore from "@/store/store";
import ActionTooltip from "../ui/action-tooltip";
import { CasePanelSheet } from "./case-panel-sheet";

interface CasePanelEntryProps {
	canEdit: boolean;
	caseId: string;
	registration: CasePanelRegistration;
	selectedElementId?: string;
	selectedElementLabel?: string;
}

/** One panel's toolbar button and its side sheet; focus returns to the button when the sheet closes. */
function CasePanelEntry({
	canEdit,
	caseId,
	registration,
	selectedElementId,
	selectedElementLabel,
}: CasePanelEntryProps) {
	const { icon: Icon = PanelRight, label, panelId } = registration;
	const [open, setOpen] = useState(false);
	const button = useRef<HTMLButtonElement>(null);
	return (
		<>
			<ActionTooltip label={label}>
				<Button
					className="rounded-full p-3"
					data-testid={`toolbar-case-panel-${panelId}`}
					onClick={() => setOpen(true)}
					ref={button}
					size="icon"
					type="button"
				>
					<Icon className="h-5 w-5" />
					<span className="sr-only">{label}</span>
				</Button>
			</ActionTooltip>
			<CasePanelSheet
				canEdit={canEdit}
				caseId={caseId}
				isOpen={open}
				onClose={() => setOpen(false)}
				registration={registration}
				returnFocusTo={button}
				selectedElementId={selectedElementId}
				selectedElementLabel={selectedElementLabel}
			/>
		</>
	);
}

/**
 * One toolbar button for each case panel an enabled plugin has registered,
 * each opening its panel in a side sheet. Renders nothing when no enabled
 * plugin has registered one.
 */
export function CasePanelButtons() {
	const { registrations } = useCasePanelSlot();
	const assuranceCase = useStore((state) => state.assuranceCase);
	const selectedId = useStore((state) => {
		const id = state.nodes.find((node) => node.selected)?.data?.id;
		return id === undefined ? undefined : String(id);
	});
	const selectedName = useStore(
		(state) => state.nodes.find((node) => node.selected)?.data?.name
	);
	if (!assuranceCase) {
		return null;
	}
	const canEdit =
		assuranceCase.permissions === "edit" ||
		assuranceCase.permissions === "manage";
	return (
		<>
			{registrations.map((registration) => (
				<CasePanelEntry
					canEdit={canEdit}
					caseId={assuranceCase.id?.toString() ?? ""}
					key={`${registration.pluginId}:${registration.panelId}`}
					registration={registration}
					selectedElementId={selectedId}
					selectedElementLabel={selectedName || undefined}
				/>
			))}
		</>
	);
}
