import { Bot } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "@/lib/logger";
import { ASSISTANT_PLUGIN_ID } from "../constants";

let entries: LogEntry[] = [];
let resetFreshSink: () => void = () => undefined;

/** A fresh copy of the slot registries, the logger and the modules that register into them. */
async function loadFresh() {
	vi.resetModules();
	const logging = await import("@/lib/logger");
	logging.setLogSink((entry) => entries.push(entry));
	resetFreshSink = logging.resetLogSink;
	const slots = await import("@/lib/plugins/slots/index");
	const { AssistantPanel } = await import("../assistant-panel");
	const { AiModelsPointer } = await import("../ai-models-pointer");
	return { slots, AssistantPanel, AiModelsPointer };
}

beforeEach(() => {
	entries = [];
	vi.stubEnv("LOG_LEVEL", "debug");
});

afterEach(() => {
	resetFreshSink();
	vi.unstubAllEnvs();
});

describe("loading the assistant's registration", () => {
	it("puts the chat panel into the case panel slot as a non-modal panel with an icon and a label", async () => {
		const { slots, AssistantPanel } = await loadFresh();

		await import("../register");

		const [panel, ...others] = slots.casePanelSlot.list();
		expect(others).toEqual([]);
		expect(panel).toMatchObject({
			pluginId: ASSISTANT_PLUGIN_ID,
			panelId: ASSISTANT_PLUGIN_ID,
			modal: false,
			icon: Bot,
			Component: AssistantPanel,
		});
		expect(panel?.label.trim()).not.toBe("");
		expect(entries).toEqual([]);
	});

	it("puts the pointer to the AI models into the settings section slot", async () => {
		const { slots, AiModelsPointer } = await loadFresh();

		await import("../register");

		expect(slots.settingsSectionSlot.list()).toStrictEqual([
			{ pluginId: ASSISTANT_PLUGIN_ID, Component: AiModelsPointer },
		]);
	});

	it("logs an error and carries on when the panel cannot be registered", async () => {
		const { slots } = await loadFresh();
		slots.casePanelSlot.register({
			pluginId: ASSISTANT_PLUGIN_ID,
			panelId: "another-panel",
			label: "Another",
			Component: () => null,
		});

		await import("../register");

		const errors = entries.filter((entry) => entry.level === "error");
		expect(errors).toHaveLength(1);
		expect(slots.casePanelSlot.list()).toHaveLength(1);
		expect(slots.settingsSectionSlot.list()).toEqual([]);
	});

	it("carries the error that stopped the registration in the log entry", async () => {
		const { slots } = await loadFresh();
		const failure = new Error("simulated panel failure");
		vi.spyOn(slots.casePanelSlot, "register").mockImplementation(() => {
			throw failure;
		});

		await import("../register");

		const errors = entries.filter((entry) => entry.level === "error");
		expect(errors).toHaveLength(1);
		expect(errors[0]?.error).toMatchObject({
			name: failure.name,
			message: failure.message,
		});
	});
});
