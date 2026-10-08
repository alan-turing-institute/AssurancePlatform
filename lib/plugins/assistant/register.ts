/**
 * The `tea.assistant` plugin's UI registration: a case panel (a non-modal
 * chat sheet beside the canvas) and a settings section for the provider, model
 * and API key. Runs once at import time, like the other
 * official plugins; a registration failure degrades to "no panel" rather than
 * taking the bundle down.
 */

import { Bot } from "lucide-react";
import { logger } from "@/lib/logger";
import { AssistantPanel } from "@/lib/plugins/assistant/assistant-panel";
import { AssistantSettings } from "@/lib/plugins/assistant/settings";
import { casePanelSlot, settingsSectionSlot } from "@/lib/plugins/slots/index";

const PLUGIN_ID = "tea.assistant";

export function registerAssistantPlugin(): void {
	try {
		casePanelSlot.register({
			pluginId: PLUGIN_ID,
			panelId: PLUGIN_ID,
			label: "Case assistant",
			icon: Bot,
			modal: false,
			Component: AssistantPanel,
		});
		settingsSectionSlot.register({
			pluginId: PLUGIN_ID,
			Component: AssistantSettings,
		});
	} catch (error) {
		logger.error(
			"[tea.assistant] UI slot registration failed — panel will not render",
			{ error }
		);
	}
}

registerAssistantPlugin();
