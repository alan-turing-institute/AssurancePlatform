"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { parseErrorMessage } from "@/hooks/use-fetch-on-mount";
import { fetchPlugins } from "@/hooks/use-plugin-enablement";
import { toastError, toastSuccess } from "@/lib/toast";

const KEY_URL = "/api/user/plugins/assistant/key";
const OPTIONS_URL = "/api/user/plugins/assistant/options";

type Provider = "anthropic" | "openai-compatible";

const PROVIDER_LABELS: Record<Provider, string> = {
	anthropic: "Anthropic",
	"openai-compatible": "OpenAI-compatible",
};

interface SavedSettings {
	baseUrl: string;
	model: string;
	provider: Provider;
}

function readSaved(settings: unknown): SavedSettings {
	const raw = (settings ?? {}) as Record<string, unknown>;
	return {
		provider:
			raw.provider === "openai-compatible" ? "openai-compatible" : "anthropic",
		baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : "",
		model: typeof raw.model === "string" ? raw.model : "",
	};
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	return (await response.json()) as T;
}

async function saveSettings(
	pluginId: string,
	settings: SavedSettings
): Promise<void> {
	// Anthropic needs no base URL, so none is stored for it.
	const body =
		settings.provider === "anthropic"
			? { provider: settings.provider, model: settings.model }
			: settings;
	await requestJson("/api/user/plugins", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ pluginId, enabled: true, settings: body }),
	});
}

function KeyControl({
	hasKey,
	onChanged,
}: {
	hasKey: boolean;
	onChanged: (hasKey: boolean) => void;
}) {
	const [replacing, setReplacing] = useState(false);
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const showInput = !hasKey || replacing;

	async function save() {
		setBusy(true);
		try {
			await requestJson(KEY_URL, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: value }),
			});
			setValue("");
			setReplacing(false);
			onChanged(true);
			toastSuccess("API key saved");
		} catch (error) {
			toastError("Could not save the key", (error as Error).message);
		} finally {
			setBusy(false);
		}
	}

	async function remove() {
		setBusy(true);
		try {
			await requestJson(KEY_URL, { method: "DELETE" });
			setReplacing(false);
			onChanged(false);
			toastSuccess("API key removed");
		} catch (error) {
			toastError("Could not remove the key", (error as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-2">
			<Label htmlFor="assistant-key">API key</Label>
			{showInput ? (
				<div className="flex gap-2">
					<Input
						autoComplete="off"
						id="assistant-key"
						onChange={(event) => setValue(event.target.value)}
						type="password"
						value={value}
					/>
					<Button
						disabled={busy || value.trim() === ""}
						onClick={save}
						type="button"
					>
						Save key
					</Button>
					{replacing && (
						<Button
							onClick={() => setReplacing(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					)}
				</div>
			) : (
				<div className="flex items-center gap-2">
					<p className="text-sm">A key is set</p>
					<Button
						disabled={busy}
						onClick={() => setReplacing(true)}
						type="button"
						variant="outline"
					>
						Replace
					</Button>
					<Button
						disabled={busy}
						onClick={remove}
						type="button"
						variant="outline"
					>
						Remove
					</Button>
				</div>
			)}
		</div>
	);
}

/** The assistant plugin's settings: provider, base URL, model and a write-only API key. */
export function AssistantSettings({ pluginId }: { pluginId: string }) {
	const [loaded, setLoaded] = useState(false);
	const [settings, setSettings] = useState<SavedSettings>({
		provider: "anthropic",
		baseUrl: "",
		model: "",
	});
	const [baseUrls, setBaseUrls] = useState<string[]>([]);
	const [hasKey, setHasKey] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			fetchPlugins(),
			requestJson<{ baseUrls: string[] }>(OPTIONS_URL),
			requestJson<{ hasKey: boolean }>(KEY_URL),
		])
			.then(([plugins, options, key]) => {
				if (cancelled) {
					return;
				}
				const mine = plugins.find((plugin) => plugin.pluginId === pluginId);
				setSettings(readSaved(mine?.settings));
				setBaseUrls(options.baseUrls);
				setHasKey(key.hasKey);
				setLoaded(true);
			})
			.catch((error: Error) => {
				if (!cancelled) {
					toastError("Could not load the assistant settings", error.message);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [pluginId]);

	const save = useCallback(async () => {
		setSaving(true);
		try {
			await saveSettings(pluginId, settings);
			toastSuccess("Assistant settings saved");
		} catch (error) {
			toastError("Could not save the settings", (error as Error).message);
		} finally {
			setSaving(false);
		}
	}, [pluginId, settings]);

	if (!loaded) {
		return null;
	}

	const openAi = settings.provider === "openai-compatible";

	return (
		<div className="space-y-4 border-border border-t pt-4">
			<div className="space-y-2">
				<Label htmlFor="assistant-provider">Provider</Label>
				<Select
					onValueChange={(value) =>
						setSettings({ ...settings, provider: value as Provider })
					}
					value={settings.provider}
				>
					<SelectTrigger id="assistant-provider">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(Object.keys(PROVIDER_LABELS) as Provider[]).map((provider) => (
							<SelectItem key={provider} value={provider}>
								{PROVIDER_LABELS[provider]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{openAi && (
				<div className="space-y-2">
					<Label htmlFor="assistant-base-url">Base URL</Label>
					<Select
						onValueChange={(value) =>
							setSettings({ ...settings, baseUrl: value })
						}
						value={settings.baseUrl}
					>
						<SelectTrigger id="assistant-base-url">
							<SelectValue
								placeholder={
									baseUrls.length === 0
										? "No base URLs are allowed on this server"
										: "Choose a base URL"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{baseUrls.map((url) => (
								<SelectItem key={url} value={url}>
									{url}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor="assistant-model">Model name</Label>
				<Input
					id="assistant-model"
					maxLength={200}
					onChange={(event) =>
						setSettings({ ...settings, model: event.target.value })
					}
					value={settings.model}
				/>
			</div>

			<Button
				disabled={saving || (openAi && settings.baseUrl === "")}
				onClick={save}
				type="button"
			>
				Save settings
			</Button>

			<KeyControl hasKey={hasKey} onChanged={setHasKey} />
		</div>
	);
}
