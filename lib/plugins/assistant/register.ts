/**
 * The `tea.assistant` plugin's UI registration: a case panel (a non-modal
 * chat sheet beside the canvas) and a one-line settings section that points to
 * the AI models block, where its models are set. Runs once at import time, like
 * the other official plugins; a registration failure degrades to "no panel"
 * rather than taking the bundle down.
 */

import { Bot } from "lucide-react";
import { logger } from "@/lib/logger";
import { AiModelsPointer } from "@/lib/plugins/assistant/ai-models-pointer";
import { AssistantPanel } from "@/lib/plugins/assistant/assistant-panel";
import { casePanelSlot, settingsSectionSlot } from "@/lib/plugins/slots/index";

const PLUGIN_ID = "tea.assistant";

function registerAssistantPlugin(): void {
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
			Component: AiModelsPointer,
		});
	} catch (error) {
		logger.error(
			"[tea.assistant] UI slot registration failed — panel will not render",
			{ error }
		);
	}
}

registerAssistantPlugin();
