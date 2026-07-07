import { formatFullDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import type {
	HealthEvidenceLogItem,
	HealthEvidenceVerdict,
} from "./use-health-evidence";

const VERDICT_LABELS: Record<HealthEvidenceVerdict, string> = {
	PASS: "Pass",
	DEGRADED: "Degraded",
	FAIL: "Fail",
};

const VERDICT_DOT_CLASSES: Record<HealthEvidenceVerdict, string> = {
	PASS: "bg-success",
	DEGRADED: "bg-warning",
	FAIL: "bg-destructive",
};

function ValueThresholdLine({
	value,
	threshold,
}: {
	value: number | null;
	threshold: number | null;
}) {
	if (value === null && threshold === null) {
		return null;
	}
	const parts = [
		value === null ? null : `Value: ${value}`,
		threshold === null ? null : `Threshold: ${threshold}`,
	].filter((part): part is string => part !== null);

	return (
		<p className="mt-1 text-muted-foreground text-sm">{parts.join(" — ")}</p>
	);
}

interface EvidenceLogEntryProps {
	item: HealthEvidenceLogItem;
}

/**
 * One row of the evidence-trace tab (ADR 0002 v2 §3): verdict, metric,
 * value/threshold, source system, evaluatedAt — with provenance behind a
 * native `<details>` disclosure (delegation brief item 3). The log is
 * regulator-grade and preserved verbatim, but not every reader of a trace
 * wants the full provenance JSON open by default; a native disclosure
 * element is fully keyboard/screen-reader accessible with no added
 * dependency, unlike a hand-rolled toggle.
 */
export function EvidenceLogEntry({ item }: EvidenceLogEntryProps) {
	return (
		<div className="rounded-md border p-3" data-testid="health-evidence-entry">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span
						aria-hidden="true"
						className={cn(
							"inline-block size-2 shrink-0 rounded-full",
							VERDICT_DOT_CLASSES[item.verdict]
						)}
					/>
					<span className="font-medium text-sm">
						{VERDICT_LABELS[item.verdict]}
					</span>
					<span className="text-muted-foreground text-sm">
						{item.metricName}
					</span>
				</div>
				<span className="whitespace-nowrap text-muted-foreground text-xs">
					{formatFullDate(item.evaluatedAt)}
				</span>
			</div>

			<ValueThresholdLine threshold={item.threshold} value={item.value} />

			<p className="mt-1 text-muted-foreground text-xs">
				Source: {item.sourceSystem}
			</p>

			<details
				className="mt-2 text-xs"
				data-testid="health-evidence-provenance"
			>
				<summary className="cursor-pointer text-muted-foreground">
					Provenance
				</summary>
				<pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
					{JSON.stringify(item.provenance, null, 2)}
				</pre>
			</details>
		</div>
	);
}
