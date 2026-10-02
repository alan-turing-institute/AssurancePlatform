"use client";

import { PanelRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCasePanelSlot } from "@/hooks/use-case-panel-slot";
import ActionTooltip from "../ui/action-tooltip";
import { CasePanelSheet } from "./case-panel-sheet";

interface CasePanelButtonsProps {
	canEdit: boolean;
	caseId: string;
}

/**
 * One toolbar button for each case panel an enabled plugin has registered,
 * each opening its panel in a side sheet. Renders nothing when no enabled
 * plugin has registered one.
 */
export function CasePanelButtons({ canEdit, caseId }: CasePanelButtonsProps) {
	const { registrations } = useCasePanelSlot();
	const [openPanelId, setOpenPanelId] = useState<string | null>(null);

	return (
		<>
			{registrations.map((registration) => {
				const {
					icon: Icon = PanelRight,
					label,
					panelId,
					pluginId,
				} = registration;
				return (
					<div className="contents" key={`${pluginId}:${panelId}`}>
						<ActionTooltip label={label}>
							<Button
								className="rounded-full p-3"
								data-testid={`toolbar-case-panel-${panelId}`}
								onClick={() => setOpenPanelId(panelId)}
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
							isOpen={openPanelId === panelId}
							onClose={() => setOpenPanelId(null)}
							registration={registration}
						/>
					</div>
				);
			})}
		</>
	);
}
