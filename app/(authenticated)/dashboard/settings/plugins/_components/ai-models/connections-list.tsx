"use client";

import { Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
	ActionResult,
	ConnectionPatch,
	ModelConnection,
	ModelSettings,
	NewConnectionInput,
	TestOutcome,
} from "@/hooks/use-model-settings";
import { CONNECTION_TYPES, MODEL_JOBS } from "@/lib/models/connection-types";
import { CONNECTION_TYPE_LABELS } from "./ai-models-copy";
import { ConnectionDialog } from "./connection-dialog";
import { RemoveConnectionDialog } from "./remove-connection-dialog";

export interface ConnectionsListProps {
	connections: readonly ModelConnection[];
	connectionTypes: ModelSettings["connectionTypes"];
	onAdd: (input: NewConnectionInput) => Promise<ActionResult>;
	onRemove: (id: string) => Promise<ActionResult>;
	onTest: (id: string) => Promise<ActionResult<TestOutcome>>;
	onUpdate: (id: string, patch: ConnectionPatch) => Promise<ActionResult>;
	/** The jobs currently set, by the connection each runs on. */
	roles: ModelSettings["roles"];
	/** Connection ids with a test in flight. */
	testing: readonly string[];
	/** The latest test result for each connection tested this session. */
	tests: Readonly<Record<string, TestOutcome>>;
}

interface Notice {
	message: string;
	tone: "error" | "info";
}

function ConnectionRow({
	connection,
	notice,
	onEdit,
	onRemove,
	onTest,
	testing,
}: {
	connection: ModelConnection;
	notice: Notice | null;
	/** Called with the button that was pressed, so focus can return to it. */
	onEdit: (opener: HTMLElement) => void;
	onRemove: (opener: HTMLElement) => void;
	onTest: () => void;
	testing: boolean;
}) {
	const addressIsEntered = CONNECTION_TYPES[connection.type].baseUrl === null;
	return (
		<li className="space-y-2 rounded-lg border border-border bg-card p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="font-medium text-foreground text-sm">
						{connection.label}
					</p>
					<p className="text-muted-foreground text-sm">
						{CONNECTION_TYPE_LABELS[connection.type]}
						{addressIsEntered && connection.baseUrl
							? `, ${connection.baseUrl}`
							: ""}
						{", "}
						{connection.hasKey ? "key set" : "no key"}
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						disabled={testing}
						onClick={onTest}
						size="sm"
						type="button"
						variant="outline"
					>
						{testing && <Loader2 aria-hidden="true" className="animate-spin" />}
						{testing ? "Testing…" : "Test"}
					</Button>
					<Button
						onClick={(event) => onEdit(event.currentTarget)}
						size="sm"
						type="button"
						variant="outline"
					>
						Edit
					</Button>
					<Button
						onClick={(event) => onRemove(event.currentTarget)}
						size="sm"
						type="button"
						variant="outline"
					>
						Remove
					</Button>
				</div>
			</div>
			{notice?.tone === "error" && (
				<p className="text-destructive text-sm" role="alert">
					{notice.message}
				</p>
			)}
			{notice?.tone === "info" && (
				<output className="block text-muted-foreground text-sm">
					{notice.message}
				</output>
			)}
		</li>
	);
}

/** The jobs whose connection is `connectionId`, in the order the screen shows them. */
function jobsUsing(roles: ModelSettings["roles"], connectionId: string) {
	return MODEL_JOBS.filter((job) => roles[job]?.connectionId === connectionId);
}

/**
 * The connections list: label, type, address (for the types where the user
 * enters one) and whether a key is set, with Test, Edit and Remove for each
 * and Add for a new one. A test shows the route's message beside its row.
 */
export function ConnectionsList({
	connections,
	connectionTypes,
	onAdd,
	onRemove,
	onTest,
	onUpdate,
	roles,
	testing,
	tests,
}: ConnectionsListProps) {
	// The connection stays set while a dialog closes, so its text does not change mid-fade.
	const [form, setForm] = useState<{
		connection?: ModelConnection;
		open: boolean;
	}>({ open: false });
	const [removal, setRemoval] = useState<{
		connection: ModelConnection | null;
		open: boolean;
	}>({ connection: null, open: false });
	const [failures, setFailures] = useState<Record<string, string>>({});
	// The dialogs are opened by buttons that are not their triggers, so each
	// returns focus itself: to the button that opened it, or to Add connection
	// when that button is gone (a removed connection's row).
	const opener = useRef<HTMLElement | null>(null);
	const addButton = useRef<HTMLButtonElement>(null);

	function returnFocus(event: Event) {
		event.preventDefault();
		const target = opener.current?.isConnected
			? opener.current
			: addButton.current;
		target?.focus();
	}

	function setFailure(id: string, message: string | null) {
		setFailures((current) => {
			const { [id]: _previous, ...rest } = current;
			return message === null ? rest : { ...rest, [id]: message };
		});
	}

	async function test(id: string) {
		const result = await onTest(id);
		setFailure(id, result.ok ? null : result.message);
	}

	async function remove(connection: ModelConnection) {
		setRemoval({ connection, open: false });
		const result = await onRemove(connection.id);
		setFailure(connection.id, result.ok ? null : result.message);
	}

	function noticeFor(id: string): Notice | null {
		const failure = failures[id];
		if (failure) {
			return { tone: "error", message: failure };
		}
		const outcome = tests[id];
		if (!outcome) {
			return null;
		}
		return { tone: outcome.ok ? "info" : "error", message: outcome.message };
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="font-medium text-foreground text-sm">Connections</h3>
				<Button
					onClick={(event) => {
						opener.current = event.currentTarget;
						setForm({ open: true });
					}}
					ref={addButton}
					size="sm"
					type="button"
					variant="outline"
				>
					<Plus aria-hidden="true" />
					Add connection
				</Button>
			</div>
			{connections.length === 0 ? (
				<Alert>
					<AlertDescription>
						No connections yet. Add one, or use quick setup above.
					</AlertDescription>
				</Alert>
			) : (
				<ul className="space-y-3">
					{connections.map((connection) => (
						<ConnectionRow
							connection={connection}
							key={connection.id}
							notice={noticeFor(connection.id)}
							onEdit={(button) => {
								opener.current = button;
								setForm({ connection, open: true });
							}}
							onRemove={(button) => {
								opener.current = button;
								setRemoval({ connection, open: true });
							}}
							onTest={() => test(connection.id)}
							testing={testing.includes(connection.id)}
						/>
					))}
				</ul>
			)}

			<ConnectionDialog
				connection={form.connection}
				connectionTypes={connectionTypes}
				onAdd={onAdd}
				onCloseAutoFocus={returnFocus}
				onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
				onUpdate={onUpdate}
				open={form.open}
			/>
			<RemoveConnectionDialog
				connection={removal.connection}
				jobs={removal.connection ? jobsUsing(roles, removal.connection.id) : []}
				onCloseAutoFocus={returnFocus}
				onConfirm={remove}
				onOpenChange={(open) => setRemoval((current) => ({ ...current, open }))}
				open={removal.open}
			/>
		</div>
	);
}
