"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
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
	EDIT_HINTS,
} from "./ai-models-copy";

type ConnectionTypeSpec = ModelSettings["connectionTypes"][number];

export interface ConnectionDialogProps {
	/** The connection being edited; absent when adding one. */
	connection?: ModelConnection;
	connectionTypes: readonly ConnectionTypeSpec[];
	onAdd: (input: NewConnectionInput) => Promise<ActionResult>;
	/** Called as the dialog closes; the page decides where focus goes. */
	onCloseAutoFocus: (event: Event) => void;
	onOpenChange: (open: boolean) => void;
	onUpdate: (id: string, patch: ConnectionPatch) => Promise<ActionResult>;
	open: boolean;
}

/** What happens to the stored key when an edit is saved. */
type KeyMode = "keep" | "replace" | "remove";

function isModelConnectionType(value: string): value is ModelConnectionType {
	return (MODEL_CONNECTION_TYPES as readonly string[]).includes(value);
}

/** The control that takes focus once a key button has swapped itself for another. */
type KeyFocus = "input" | "keep" | "remove" | "replace";

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
	// The pressed button leaves the page when the mode changes, which would drop
	// focus to the dialog; the control that replaces it takes focus instead.
	const controls = useRef<Partial<Record<KeyFocus, HTMLElement | null>>>({});
	const [focusNext, setFocusNext] = useState<KeyFocus | null>(null);
	useEffect(() => {
		if (focusNext) {
			controls.current[focusNext]?.focus();
			setFocusNext(null);
		}
	}, [focusNext]);
	const register = (name: KeyFocus) => (element: HTMLElement | null) => {
		controls.current[name] = element;
	};
	const switchTo = (next: KeyMode, focus: KeyFocus) => {
		onModeChange(next);
		setFocusNext(focus);
	};

	if (hasKey && mode === "keep") {
		return (
			<div className="space-y-2">
				<p className="font-medium text-sm">Key</p>
				<p className="text-muted-foreground text-sm">
					A key is stored. It is never shown again.
				</p>
				<div className="flex gap-2">
					<Button
						onClick={() => switchTo("replace", "input")}
						ref={register("replace")}
						size="sm"
						type="button"
						variant="outline"
					>
						Replace key
					</Button>
					{!keyRequired && (
						<Button
							onClick={() => switchTo("remove", "keep")}
							ref={register("remove")}
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
					onClick={() => switchTo("keep", "remove")}
					ref={register("keep")}
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
				ref={register("input")}
				type="password"
				value={value}
			/>
			{hasKey && (
				<Button
					onClick={() => switchTo("keep", "replace")}
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
						<RadioGroupItem
							aria-describedby={`${groupId}-${type}-hint`}
							id={`${groupId}-${type}`}
							value={type}
						/>
						<div className="space-y-1">
							<Label htmlFor={`${groupId}-${type}`}>
								{CONNECTION_TYPE_LABELS[type]}
							</Label>
							<p
								className="text-muted-foreground text-sm"
								id={`${groupId}-${type}-hint`}
							>
								{CONNECTION_TYPE_HINTS[type]}
							</p>
						</div>
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

/** The body for adding a connection: an address only for types where the user enters one, a key only when one was typed. */
function newConnectionFrom(
	state: FormState,
	addressIsEntered: boolean
): NewConnectionInput {
	const apiKey = state.apiKey.trim();
	return {
		type: state.type,
		label: state.label.trim(),
		...(addressIsEntered ? { baseUrl: state.baseUrl.trim() } : {}),
		...(apiKey ? { apiKey } : {}),
	};
}

/** Whether every field the type needs has a value; a stored key counts as the key. */
function isFilledIn(
	state: FormState,
	needs: { addressIsEntered: boolean; keyRequired: boolean; keyStored: boolean }
): boolean {
	const addressMissing = needs.addressIsEntered && state.baseUrl.trim() === "";
	const keyMissing =
		needs.keyRequired && state.apiKey.trim() === "" && !needs.keyStored;
	return state.label.trim() !== "" && !addressMissing && !keyMissing;
}

function AddressField({
	onChange,
	type,
	value,
}: {
	onChange: (value: string) => void;
	type: ModelConnectionType;
	value: string;
}) {
	const id = useId();
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>Address</Label>
			<Input
				autoComplete="off"
				id={id}
				maxLength={MODEL_FIELD_LIMITS.baseUrl}
				onChange={(event) => onChange(event.target.value)}
				placeholder={ADDRESS_PLACEHOLDERS[type]}
				type="url"
				value={value}
			/>
			<p className="text-muted-foreground text-sm">{ADDRESS_HINTS[type]}</p>
		</div>
	);
}

function ConnectionForm({
	connection,
	connectionTypes,
	onAdd,
	onClose,
	onUpdate,
}: Omit<ConnectionDialogProps, "onCloseAutoFocus" | "onOpenChange" | "open"> & {
	onClose: () => void;
}) {
	const labelId = useId();
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
	const complete = isFilledIn(state, {
		addressIsEntered,
		keyRequired,
		keyStored: hasKey,
	});
	const canSave = complete && !busy && (!editing || patch !== null);

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
			: await onAdd(newConnectionFrom(state, addressIsEntered));
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
				<AddressField
					onChange={(baseUrl) => setState({ ...state, baseUrl })}
					type={state.type}
					value={state.baseUrl}
				/>
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
	onCloseAutoFocus,
	onOpenChange,
	...form
}: ConnectionDialogProps) {
	const editing = connection !== undefined;
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent onCloseAutoFocus={onCloseAutoFocus}>
				<DialogHeader>
					<DialogTitle>
						{editing ? (
							<>
								Edit <span className="break-all">{connection.label}</span>
							</>
						) : (
							"Add a connection"
						)}
					</DialogTitle>
					<DialogDescription>
						{editing
							? EDIT_HINTS[connection.type]
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
