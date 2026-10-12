"use client";

import { type FormEvent, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
	ActionResult,
	ConnectionPatch,
	ModelConnection,
	ModelSettings,
	NewConnectionInput,
} from "@/hooks/use-model-settings";
import {
	MODEL_CONNECTION_TYPES,
	MODEL_FIELD_LIMITS,
	type ModelConnectionType,
} from "@/lib/models/connection-types";
import {
	ADDRESS_HINTS,
	ADDRESS_PLACEHOLDERS,
	CONNECTION_TYPE_HINTS,
	CONNECTION_TYPE_LABELS,
} from "./ai-models-copy";

type ConnectionTypeSpec = ModelSettings["connectionTypes"][number];

export interface ConnectionDialogProps {
	/** The connection being edited; absent when adding one. */
	connection?: ModelConnection;
	connectionTypes: readonly ConnectionTypeSpec[];
	onAdd: (input: NewConnectionInput) => Promise<ActionResult>;
	onOpenChange: (open: boolean) => void;
	onUpdate: (id: string, patch: ConnectionPatch) => Promise<ActionResult>;
	open: boolean;
}

/** What happens to the stored key when an edit is saved. */
type KeyMode = "keep" | "replace" | "remove";

function isModelConnectionType(value: string): value is ModelConnectionType {
	return (MODEL_CONNECTION_TYPES as readonly string[]).includes(value);
}

function KeyField({
	hasKey,
	keyRequired,
	mode,
	onModeChange,
	onValueChange,
	value,
}: {
	hasKey: boolean;
	keyRequired: boolean;
	mode: KeyMode;
	onModeChange: (mode: KeyMode) => void;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const inputId = useId();
	if (hasKey && mode === "keep") {
		return (
			<div className="space-y-2">
				<p className="font-medium text-sm">Key</p>
				<p className="text-muted-foreground text-sm">
					A key is stored. It is never shown again.
				</p>
				<div className="flex gap-2">
					<Button
						onClick={() => onModeChange("replace")}
						size="sm"
						type="button"
						variant="outline"
					>
						Replace key
					</Button>
					{!keyRequired && (
						<Button
							onClick={() => onModeChange("remove")}
							size="sm"
							type="button"
							variant="outline"
						>
							Remove key
						</Button>
					)}
				</div>
			</div>
		);
	}
	if (mode === "remove") {
		return (
			<div className="space-y-2">
				<p className="font-medium text-sm">Key</p>
				<p className="text-muted-foreground text-sm">
					The key will be removed when you save.
				</p>
				<Button
					onClick={() => onModeChange("keep")}
					size="sm"
					type="button"
					variant="outline"
				>
					Keep key
				</Button>
			</div>
		);
	}
	const heading = hasKey ? "New key" : `Key${keyRequired ? "" : " (optional)"}`;
	return (
		<div className="space-y-2">
			<Label htmlFor={inputId}>{heading}</Label>
			<Input
				autoComplete="off"
				id={inputId}
				maxLength={MODEL_FIELD_LIMITS.apiKey}
				onChange={(event) => onValueChange(event.target.value)}
				type="password"
				value={value}
			/>
			{hasKey && (
				<Button
					onClick={() => onModeChange("keep")}
					size="sm"
					type="button"
					variant="outline"
				>
					Keep the stored key
				</Button>
			)}
		</div>
	);
}

function TypeChoice({
	onChange,
	types,
	value,
}: {
	onChange: (type: ModelConnectionType) => void;
	types: readonly ConnectionTypeSpec[];
	value: ModelConnectionType;
}) {
	const groupId = useId();
	return (
		<div className="space-y-2">
			<p className="font-medium text-sm" id={groupId}>
				Type
			</p>
			<RadioGroup
				aria-labelledby={groupId}
				onValueChange={(next) => {
					if (isModelConnectionType(next)) {
						onChange(next);
					}
				}}
				value={value}
			>
				{types.map(({ type }) => (
					<div className="flex items-start gap-2" key={type}>
						<RadioGroupItem id={`${groupId}-${type}`} value={type} />
						<Label className="space-y-1" htmlFor={`${groupId}-${type}`}>
							<span className="block">{CONNECTION_TYPE_LABELS[type]}</span>
							<span className="block font-normal text-muted-foreground">
								{CONNECTION_TYPE_HINTS[type]}
							</span>
						</Label>
					</div>
				))}
			</RadioGroup>
		</div>
	);
}

interface FormState {
	apiKey: string;
	baseUrl: string;
	keyMode: KeyMode;
	label: string;
	type: ModelConnectionType;
}

function initialState(
	connection: ModelConnection | undefined,
	firstType: ModelConnectionType
): FormState {
	const type = connection?.type ?? firstType;
	return {
		type,
		label: connection?.label ?? CONNECTION_TYPE_LABELS[type],
		baseUrl: connection?.baseUrl ?? "",
		apiKey: "",
		keyMode: "keep",
	};
}

/** The fields an edit changed, or null when nothing changed. */
function changesTo(
	connection: ModelConnection,
	state: FormState,
	addressIsEntered: boolean
): ConnectionPatch | null {
	const patch: ConnectionPatch = {};
	const label = state.label.trim();
	if (label !== connection.label) {
		patch.label = label;
	}
	const baseUrl = state.baseUrl.trim();
	if (addressIsEntered && baseUrl !== (connection.baseUrl ?? "")) {
		patch.baseUrl = baseUrl;
	}
	if (state.keyMode === "remove") {
		patch.apiKey = null;
	} else if (state.apiKey.trim() !== "") {
		patch.apiKey = state.apiKey.trim();
	}
	return Object.keys(patch).length > 0 ? patch : null;
}

function ConnectionForm({
	connection,
	connectionTypes,
	onAdd,
	onClose,
	onUpdate,
}: Omit<ConnectionDialogProps, "open" | "onOpenChange"> & {
	onClose: () => void;
}) {
	const labelId = useId();
	const addressId = useId();
	const [state, setState] = useState(() =>
		initialState(connection, connectionTypes[0]?.type ?? "OPENROUTER")
	);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const spec = connectionTypes.find((item) => item.type === state.type);
	const addressIsEntered = spec?.baseUrl === null;
	const keyRequired = spec?.keyRequired ?? false;
	const editing = connection !== undefined;
	const hasKey = connection?.hasKey ?? false;

	const patch = connection
		? changesTo(connection, state, addressIsEntered)
		: null;
	const keyMissing =
		keyRequired && state.apiKey.trim() === "" && !(editing && hasKey);
	const complete =
		state.label.trim() !== "" &&
		!(addressIsEntered && state.baseUrl.trim() === "") &&
		!keyMissing;
	const canSave = complete && !busy && (editing ? patch !== null : true);

	function changeType(type: ModelConnectionType) {
		setState((current) => ({
			...current,
			type,
			label:
				current.label === CONNECTION_TYPE_LABELS[current.type]
					? CONNECTION_TYPE_LABELS[type]
					: current.label,
		}));
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!canSave) {
			return;
		}
		setBusy(true);
		setFailure(null);
		const result = connection
			? await onUpdate(connection.id, patch ?? {})
			: await onAdd({
					type: state.type,
					label: state.label.trim(),
					...(addressIsEntered ? { baseUrl: state.baseUrl.trim() } : {}),
					...(state.apiKey.trim() ? { apiKey: state.apiKey.trim() } : {}),
				});
		setBusy(false);
		if (result.ok) {
			onClose();
			return;
		}
		setFailure(result.message);
	}

	return (
		<form className="space-y-4" onSubmit={submit}>
			{failure && (
				<Alert variant="destructive">
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			)}
			{editing ? (
				<p className="text-muted-foreground text-sm">
					Type: {CONNECTION_TYPE_LABELS[state.type]}
				</p>
			) : (
				<TypeChoice
					onChange={changeType}
					types={connectionTypes}
					value={state.type}
				/>
			)}
			<div className="space-y-2">
				<Label htmlFor={labelId}>Label</Label>
				<Input
					id={labelId}
					maxLength={MODEL_FIELD_LIMITS.label}
					onChange={(event) =>
						setState({ ...state, label: event.target.value })
					}
					value={state.label}
				/>
			</div>
			{addressIsEntered && (
				<div className="space-y-2">
					<Label htmlFor={addressId}>Address</Label>
					<Input
						autoComplete="off"
						id={addressId}
						maxLength={MODEL_FIELD_LIMITS.baseUrl}
						onChange={(event) =>
							setState({ ...state, baseUrl: event.target.value })
						}
						placeholder={ADDRESS_PLACEHOLDERS[state.type]}
						type="url"
						value={state.baseUrl}
					/>
					<p className="text-muted-foreground text-sm">
						{ADDRESS_HINTS[state.type]}
					</p>
				</div>
			)}
			<KeyField
				hasKey={hasKey}
				keyRequired={keyRequired}
				mode={state.keyMode}
				onModeChange={(keyMode) => setState({ ...state, keyMode, apiKey: "" })}
				onValueChange={(apiKey) => setState({ ...state, apiKey })}
				value={state.apiKey}
			/>
			<DialogFooter>
				<Button onClick={onClose} type="button" variant="outline">
					Cancel
				</Button>
				<Button disabled={!canSave} type="submit">
					{editing ? "Save changes" : "Add connection"}
				</Button>
			</DialogFooter>
		</form>
	);
}

/**
 * The Add and Edit dialog for a model connection. Adding starts with a choice
 * of type; OpenRouter and Anthropic ask for a label and a key, Ollama and
 * OpenAI-compatible servers for a label, an address and an optional key.
 * Editing keeps the type, and the stored key is write-only: it can be
 * replaced, or removed where the type allows. The form is built only while
 * the dialog is open, so nothing typed survives closing it.
 */
export function ConnectionDialog({
	connection,
	open,
	onOpenChange,
	...form
}: ConnectionDialogProps) {
	const editing = connection !== undefined;
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{editing ? `Edit ${connection.label}` : "Add a connection"}
					</DialogTitle>
					<DialogDescription>
						{editing
							? "Change the label or address, or replace the key."
							: "Choose the kind of server, then say how to reach it."}
					</DialogDescription>
				</DialogHeader>
				{open && (
					<ConnectionForm
						connection={connection}
						key={connection?.id ?? "new"}
						onClose={() => onOpenChange(false)}
						{...form}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
