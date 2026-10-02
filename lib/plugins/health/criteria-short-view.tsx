"use client";

import { Button } from "@/components/ui/button";
import { isWholeSystem } from "./criteria-draft";
import { Section, TextField } from "./criteria-fields";
import { remainingLines, subjectsOf } from "./criteria-plain-words";
import { type SectionProps, TimingFields } from "./criteria-sections";

/**
 * The short view of settings that are not yet accepted: the few numbers that
 * matter most, editable, and a read-only line for each other block, with a
 * button that opens every setting.
 */
export function ShortViewBody({
	onShowAll,
	...props
}: SectionProps & { onShowAll: () => void }) {
	const { analysis, check, disabled, draft, setDraft } = props;
	const subjects = subjectsOf(check);
	return (
		<>
			<Section title="The numbers that matter most">
				{!isWholeSystem(check) && (
					<TextField
						disabled={disabled}
						error={analysis.errors["aggregation.params.threshold"]}
						inputMode="decimal"
						label={`The claim passes when this share of ${subjects.many} pass`}
						onChange={(threshold) =>
							setDraft({
								aggregation: { ...draft.aggregation, threshold },
							})
						}
						suffix="%"
						value={draft.aggregation.threshold}
					/>
				)}
				<TimingFields {...props} />
			</Section>
			<Section
				action={
					<Button onClick={onShowAll} size="sm" type="button" variant="outline">
						Show all settings
					</Button>
				}
				title="Everything else"
			>
				<dl className="space-y-2">
					{remainingLines(analysis.settings, check).map((line) => (
						<div className="min-w-0 space-y-0.5" key={line.label}>
							<dt className="text-muted-foreground text-xs">{line.label}</dt>
							<dd className="wrap-anywhere text-sm">{line.text}</dd>
						</div>
					))}
				</dl>
			</Section>
		</>
	);
}
