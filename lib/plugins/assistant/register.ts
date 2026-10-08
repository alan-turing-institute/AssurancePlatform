/**
 * The `tea.assistant` plugin's UI registration: one case panel, a non-modal
 * chat sheet beside the canvas. Runs once at import time, like the other
 * official plugins; a registration failure degrades to "no panel" rather than
 * taking the bundle down.
 */

import { Bot } from "lucide-react";
import { logger } from "@/lib/logger";
import { AssistantPanel } from "@/lib/plugins/assistant/assistant-panel";
import { casePanelSlot } from "@/lib/plugins/slots/index";

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
	} catch (error) {
		logger.error(
			"[tea.assistant] UI slot registration failed — panel will not render",
			{ error }
		);
	}
}

registerAssistantPlugin();
