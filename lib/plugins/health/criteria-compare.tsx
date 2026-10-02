"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
	BlockRow,
	MoveBlock,
	MoveChoice,
	MoveChoices,
} from "./criteria-version-move";

interface CompareColumnProps {
	lines: string[];
	title: string;
}

/** One side of a row, as text; every line comes from the plain-words summary. */
function CompareColumn({ lines, title }: CompareColumnProps) {
	return (
		<div className="min-w-0 space-y-1">
			<p className="font-medium text-xs">{title}</p>
			<ul className="space-y-1">
				{lines.map((line) => (
					<li className="wrap-anywhere text-sm" key={line}>
						{line}
					</li>
				))}
			</ul>
		</div>
	);
}

const ROW_NOTES: Record<"none" | "same", string> = {
	same: "The recommendation is the same as your settings. Nothing to choose.",
	none: "The new version recommends nothing for this. Your settings stay as they are.",
};

interface CompareRowProps {
	choice: MoveChoice;
	onChoice: (choice: MoveChoice) => void;
	row: BlockRow;
	version: string;
}

function CompareRow({ choice, onChoice, row, version }: CompareRowProps) {
	const id = useId();
	const legendId = `${id}-legend`;
	const keepId = `${id}-keep`;
	const takeId = `${id}-take`;
	return (
		<fieldset
			className="space-y-3 rounded-md border p-3"
			data-block={row.block}
			data-testid={`health-compare-${row.block}`}
		>
			<legend className="px-1 font-medium text-sm" id={legendId}>
				{row.label}
			</legend>
			<div className="grid gap-3 sm:grid-cols-2">
				<CompareColumn lines={row.yours} title="Your accepted settings" />
				<CompareColumn
					lines={row.recommended}
					title={`Recommended for version ${version}`}
				/>
			</div>
			{row.kind === "pick" ? (
				<RadioGroup
					aria-labelledby={legendId}
					onValueChange={(next) => onChoice(next === "take" ? "take" : "keep")}
					value={choice}
				>
					<div className="flex items-center gap-2">
						<RadioGroupItem id={keepId} value="keep" />
						<Label htmlFor={keepId}>Keep yours</Label>
					</div>
					<div className="flex items-center gap-2">
						<RadioGroupItem id={takeId} value="take" />
						<Label htmlFor={takeId}>Take the recommendation</Label>
					</div>
				</RadioGroup>
			) : (
				<p className="text-muted-foreground text-sm">{ROW_NOTES[row.kind]}</p>
			)}
		</fieldset>
	);
}

export interface VersionCompareProps {
	newVersion: string;
	onCancel: () => void;
	onContinue: (choices: MoveChoices) => void;
	rows: BlockRow[];
}

/**
 * Accepted settings beside what a new version of the check recommends, one
 * row for each block. Each row that differs offers "Keep yours" (the
 * default) or "Take the recommendation"; nothing is taken unless chosen.
 * Continue hands the choices on and saves nothing.
 */
export function VersionCompare({
	newVersion,
	onCancel,
	onContinue,
	rows,
}: VersionCompareProps) {
	const [choices, setChoices] = useState<MoveChoices>({});
	const heading = useRef<HTMLHeadingElement>(null);
	// The button that opened this view is hidden with the form, so focus moves here.
	useEffect(() => {
		heading.current?.focus();
	}, []);
	const choose = (block: MoveBlock, choice: MoveChoice) =>
		setChoices((current) => ({ ...current, [block]: choice }));
	return (
		<div className="space-y-4" data-testid="health-version-compare">
			<h3
				className="font-medium text-sm outline-none"
				ref={heading}
				tabIndex={-1}
			>
				Compare with version {newVersion}
			</h3>
			<p className="text-sm">
				Choose, block by block, whether to keep your accepted settings or take
				what the new version recommends. Nothing changes until you save the
				settings on the next screen.
			</p>
			{rows.map((row) => (
				<CompareRow
					choice={choices[row.block] ?? "keep"}
					key={row.block}
					onChoice={(choice) => choose(row.block, choice)}
					row={row}
					version={newVersion}
				/>
			))}
			<div className="flex flex-wrap items-center gap-2">
				<Button onClick={() => onContinue(choices)} type="button">
					Continue
				</Button>
				<Button onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
			</div>
		</div>
	);
}
