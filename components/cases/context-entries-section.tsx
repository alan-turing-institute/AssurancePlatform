"use client";

import { Lock, PlusIcon, Tag, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type {
	ContextEntry,
	NamedContextEntry,
} from "@/lib/schemas/context-entry";
import type { NodeEditFormInput } from "@/lib/schemas/element";
import { isNamedEntryValue } from "./context-entry-form";

type FormValues = NodeEditFormInput;

interface ContextEntriesSectionProps {
	contextItems: Array<{ id: string; value: ContextEntry }>;
	form: UseFormReturn<FormValues>;
	newContextValue: string;
	onAddContext: () => void;
	onNameContext: (idx: number) => void;
	onNewContextChange: (value: string) => void;
	onRemoveContext: (idx: number) => void;
	onUnnameContext: (idx: number) => void;
	/** A problem with the list as a whole, such as two entries sharing a name. */
	problem?: string;
	readOnly: boolean;
}

interface RowProps {
	form: UseFormReturn<FormValues>;
	idx: number;
	onRemove: () => void;
	readOnly: boolean;
}

/** Enter in an entry's box must not submit the dialog's form. */
function ignoreEnter(event: React.KeyboardEvent) {
	if (event.key === "Enter") {
		event.preventDefault();
	}
}

function RemoveEntryButton({ onRemove }: { onRemove: () => void }) {
	return (
		<button
			className="rounded p-1 text-destructive hover:bg-destructive/10"
			onClick={onRemove}
			title="Remove context"
			type="button"
		>
			<Trash2 className="h-4 w-4" />
		</button>
	);
}

function PlainEntryRow({
	idx,
	form,
	onName,
	onRemove,
	readOnly,
}: RowProps & { onName: () => void }) {
	return (
		<FormField
			control={form.control}
			name={`context.${idx}`}
			render={({ field }) => (
				<FormItem>
					<div className="flex items-start gap-2">
						<FormControl>
							<Input
								aria-label={`Context entry ${idx + 1}`}
								onKeyDown={ignoreEnter}
								readOnly={readOnly}
								{...field}
								value={typeof field.value === "string" ? field.value : ""}
							/>
						</FormControl>
						{!readOnly && (
							<>
								<button
									aria-label={`Name context entry ${idx + 1}`}
									className="rounded p-1 text-muted-foreground hover:bg-muted"
									onClick={onName}
									title="Give this entry a name so text below can refer to it"
									type="button"
								>
									<Tag className="h-4 w-4" />
								</button>
								<RemoveEntryButton onRemove={onRemove} />
							</>
						)}
					</div>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

interface EntryInputProps {
	error?: string;
	inputRef?: (element: HTMLInputElement | null) => void;
	label: string;
	onChange: (value: string) => void;
	placeholder: string;
	readOnly: boolean;
	value: string;
}

/** One box of a named entry, with the message for what is wrong with it. */
function EntryInput({
	error,
	inputRef,
	label,
	onChange,
	placeholder,
	readOnly,
	value,
}: EntryInputProps) {
	return (
		<div className="space-y-1">
			<Input
				aria-invalid={!!error}
				aria-label={label}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={ignoreEnter}
				placeholder={placeholder}
				readOnly={readOnly}
				ref={inputRef}
				value={value}
			/>
			{error && (
				<p className="font-medium text-destructive text-sm" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

interface EntryProblems {
	name?: string;
	text?: string;
	value?: string;
}

/**
 * What the form's validation says is wrong with each part of the entry at
 * `idx`. The schema reports it at `context.<idx>.name` and so on, below the
 * one field this row is registered as.
 */
function entryProblems(
	form: UseFormReturn<FormValues>,
	idx: number
): EntryProblems {
	const reported = form.formState.errors.context?.[idx] as
		| Record<keyof EntryProblems, { message?: string } | undefined>
		| undefined;
	return {
		name: reported?.name?.message,
		text: reported?.text?.message,
		value: reported?.value?.message,
	};
}

function UnnameWarning({
	entry,
	onCancel,
	onConfirm,
}: {
	entry: NamedContextEntry;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div
			className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-2 text-xs"
			role="alert"
		>
			<p>
				Without a name, this entry loses its value ({entry.value}), and text
				that refers to {entry.name || "it"} will show it as not found.
			</p>
			<div className="flex gap-2">
				<Button onClick={onConfirm} size="sm" type="button" variant="outline">
					Remove name and value
				</Button>
				<Button onClick={onCancel} size="sm" type="button" variant="ghost">
					Keep name
				</Button>
			</div>
		</div>
	);
}

function NamedEntryRow({
	entry,
	idx,
	form,
	onRemove,
	onUnname,
	readOnly,
}: RowProps & { entry: NamedContextEntry; onUnname: () => void }) {
	const [confirming, setConfirming] = useState(false);
	const nameBox = useRef<HTMLInputElement | null>(null);
	const startedWithoutName = useRef(entry.name === "");
	useEffect(() => {
		if (startedWithoutName.current) {
			nameBox.current?.focus();
		}
	}, []);
	const hasValue = !!entry.value?.trim();
	const label = `Context entry ${idx + 1}`;
	const problems = entryProblems(form, idx);
	return (
		// The whole entry is one field of the form, so a row never registers both a
		// field and the parts below it.
		<FormField
			control={form.control}
			name={`context.${idx}`}
			render={({ field }) => {
				const current = isNamedEntryValue(field.value) ? field.value : entry;
				const update = (patch: Partial<NamedContextEntry>) =>
					field.onChange({ ...current, ...patch });
				return (
					<div className="space-y-2 rounded-md border p-2">
						<div className="flex items-start gap-2">
							<div className="flex-1">
								<EntryInput
									error={problems.name}
									inputRef={(element) => {
										nameBox.current = element;
										field.ref(element);
									}}
									label={`${label} name`}
									onChange={(name) => update({ name })}
									placeholder="Name, such as window"
									readOnly={readOnly}
									value={current.name}
								/>
							</div>
							{!readOnly && (
								<>
									<Button
										onClick={() =>
											hasValue ? setConfirming(true) : onUnname()
										}
										size="sm"
										type="button"
										variant="ghost"
									>
										Remove name
									</Button>
									<RemoveEntryButton onRemove={onRemove} />
								</>
							)}
						</div>
						{confirming && (
							<UnnameWarning
								entry={current}
								onCancel={() => setConfirming(false)}
								onConfirm={onUnname}
							/>
						)}
						<EntryInput
							error={problems.text}
							label={label}
							onChange={(text) => update({ text })}
							placeholder="What the name means"
							readOnly={readOnly}
							value={current.text}
						/>
						<EntryInput
							error={problems.value}
							label={`${label} value`}
							onChange={(value) => update({ value })}
							placeholder="Value (optional), such as 5 minutes"
							readOnly={readOnly}
							value={current.value ?? ""}
						/>
					</div>
				);
			}}
		/>
	);
}

/**
 * The dialog's context section. An entry is plain text unless it has been
 * given a name, which lets text on this element and the ones below refer to
 * it, and an optional value. A named entry shows its name above its text.
 */
export default function ContextEntriesSection({
	contextItems,
	form,
	newContextValue,
	onAddContext,
	onNameContext,
	onNewContextChange,
	onRemoveContext,
	onUnnameContext,
	problem,
	readOnly,
}: ContextEntriesSectionProps) {
	return (
		<div className="space-y-3">
			<FormLabel className="flex items-center gap-2">
				Context
				{readOnly && (
					<span className="text-muted-foreground" title="Read Only">
						<Lock className="h-3 w-3" />
					</span>
				)}
			</FormLabel>
			{contextItems.length > 0 && (
				<div className="space-y-2">
					{contextItems.map((item, idx) =>
						isNamedEntryValue(item.value) ? (
							<NamedEntryRow
								entry={item.value}
								form={form}
								idx={idx}
								key={item.id}
								onRemove={() => onRemoveContext(idx)}
								onUnname={() => onUnnameContext(idx)}
								readOnly={readOnly}
							/>
						) : (
							<PlainEntryRow
								form={form}
								idx={idx}
								key={item.id}
								onName={() => onNameContext(idx)}
								onRemove={() => onRemoveContext(idx)}
								readOnly={readOnly}
							/>
						)
					)}
				</div>
			)}
			{problem && (
				<p className="font-medium text-destructive text-sm" role="alert">
					{problem}
				</p>
			)}
			{!readOnly && (
				<div className="flex gap-2">
					<Input
						onChange={(e) => onNewContextChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								onAddContext();
							}
						}}
						placeholder="Add new context..."
						value={newContextValue}
					/>
					<Button
						disabled={!newContextValue.trim()}
						onClick={onAddContext}
						size="sm"
						type="button"
						variant="outline"
					>
						<PlusIcon className="size-4" />
						Add
					</Button>
				</div>
			)}
		</div>
	);
}
