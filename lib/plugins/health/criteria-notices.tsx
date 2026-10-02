import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { PlainSentence } from "./criteria-plain-words";
import { describeDifferences } from "./echo-difference-words";
import { formatDateTime } from "./health-format";
import type { HealthCriteriaResponse } from "./health-types";

/**
 * Read-only lines around the settings form: what the settings are in plain
 * words, who changed them, whether the check is still offered, and what the
 * pipeline has done with them. Every string a person or a pipeline supplied
 * is rendered as text.
 */

function Notice({
	children,
	focusOnMount = false,
	testId,
	tone = "info",
}: {
	children: ReactNode;
	/** Takes focus when it first appears, for a notice that heads a view the person has just moved to. */
	focusOnMount?: boolean;
	testId?: string;
	tone?: "info" | "warning";
}) {
	const element = useRef<HTMLParagraphElement>(null);
	useEffect(() => {
		if (focusOnMount) {
			element.current?.focus();
		}
	}, [focusOnMount]);
	return (
		<p
			className={
				tone === "warning"
					? "wrap-anywhere rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
					: "wrap-anywhere rounded-md border bg-muted/40 px-3 py-2 text-sm outline-none"
			}
			data-testid={testId}
			ref={element}
			tabIndex={focusOnMount ? -1 : undefined}
		>
			{children}
		</p>
	);
}

/** The settings as a short list of sentences; always shown beside the buttons that save them. */
export function PlainWordsSummary({
	sentences,
}: {
	sentences: PlainSentence[];
}) {
	return (
		<section
			aria-labelledby="health-plain-words"
			className="space-y-1.5 rounded-md border bg-muted/30 p-3"
			data-testid="health-plain-words"
		>
			<h3 className="font-medium text-sm" id="health-plain-words">
				In plain words
			</h3>
			<ul className="space-y-1">
				{sentences.map((sentence) => (
					<li
						className="wrap-anywhere text-sm"
						data-sentence={sentence.key}
						key={sentence.key}
					>
						{sentence.text}
					</li>
				))}
			</ul>
		</section>
	);
}

export interface CompareOffer {
	/** The button's element, so focus can return to it when the comparison is cancelled. */
	buttonRef?: RefObject<HTMLButtonElement | null>;
	newVersion: string;
	onOpen: () => void;
}

/** Notices that depend on the state the settings are in; `compare` adds the button that opens the move to a newer version. */
export function StateNotices({
	compare,
	view,
}: {
	compare?: CompareOffer | null;
	view: HealthCriteriaResponse;
}) {
	const { criteria, last_change: change } = view;
	const notices: ReactNode[] = [];
	if (criteria?.state === "suggested" && change) {
		notices.push(
			<Notice key="suggested" testId="health-suggested-banner">
				Suggested by {change.by_name} on {formatDateTime(change.at)}. Nothing is
				used until these settings are accepted.
			</Notice>
		);
	}
	if (criteria?.state === "accepted" && criteria.accepted_at) {
		notices.push(
			<Notice key="accepted" testId="health-accepted-line">
				Accepted by {view.accepted_by?.name ?? "an unknown person"}
				{view.accepted_by?.owns_integration ? ", the pipeline's owner," : ""} on{" "}
				{formatDateTime(criteria.accepted_at)}.
			</Notice>
		);
	}
	if (view.check_offer === "not-offered") {
		notices.push(
			<Notice key="gone" tone="warning">
				The pipeline no longer offers this check. Results that still arrive are
				compared with these settings.
			</Notice>
		);
	}
	if (view.check_offer === "newer-version") {
		notices.push(
			<div className="space-y-2" key="newer">
				<Notice tone="warning">
					The pipeline now offers a different version of this check.
				</Notice>
				{compare && (
					<Button
						onClick={compare.onOpen}
						ref={compare.buttonRef}
						size="sm"
						type="button"
						variant="outline"
					>
						Compare with version {compare.newVersion}
					</Button>
				)}
			</div>
		);
	}
	return notices.length > 0 ? <div className="space-y-2">{notices}</div> : null;
}

/** Where a fresh pick's numbers come from, and that none of them is in use yet. */
export function FreshPickNotice({ recommends }: { recommends: boolean }) {
	return (
		<Notice testId="health-fresh-pick-notice">
			{recommends
				? "These are the settings the check recommends. Nothing is used until you accept them. Change any number first if it does not fit this claim."
				: "This check recommends no settings. Nothing is used until you accept the ones you enter."}
		</Notice>
	);
}

/** Settings moved to another version of the check are held in the form and not yet saved. */
export function MoveNotice({ version }: { version: string }) {
	return (
		<Notice focusOnMount testId="health-move-notice">
			These settings are for version {version} of the check. Nothing is saved
			until you press Save settings.
		</Notice>
	);
}

/** For settings that were stopped or discarded: who, when and why. */
export function StoppedNotice({ view }: { view: HealthCriteriaResponse }) {
	const { last_change: change } = view;
	if (view.criteria?.state !== "inactive" || !change) {
		return null;
	}
	const what =
		change.action === "discarded"
			? "A suggestion was discarded"
			: "The previous settings were stopped";
	return (
		<Notice testId="health-stopped-line">
			{what} by {change.by_name} on {formatDateTime(change.at)}
			{change.reason ? `. Reason: ${change.reason}` : "."}
		</Notice>
	);
}

/** What the pipeline has read of accepted settings, and how its latest result compares. */
export function PipelineFooter({
	view,
}: {
	view: HealthCriteriaResponse | null;
}) {
	if (view?.criteria?.state !== "accepted") {
		return null;
	}
	const read = view.pipeline_read;
	let line = "The pipeline has not read these settings yet.";
	if (read) {
		line =
			read.revision === view.criteria.revision
				? `The pipeline read these settings at ${formatDateTime(read.at)}.`
				: `The pipeline read an earlier version at ${formatDateTime(read.at)}.`;
	}
	const differences = view.latest_result?.differences ?? [];
	return (
		<div
			className="space-y-1 border-t pt-3 text-muted-foreground text-sm"
			data-testid="health-settings-footer"
		>
			<p className="wrap-anywhere">{line}</p>
			{describeDifferences(differences).map((sentence) => (
				<p className="wrap-anywhere" key={sentence}>
					{sentence}
				</p>
			))}
		</div>
	);
}
