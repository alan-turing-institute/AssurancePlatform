import type { LogWarningsFunction, Warning } from "ai";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "ai-sdk-warnings" });

/** The warning's type and the names of what it concerns, never its text. */
function warningFields(warning: Warning): Record<string, string> {
	const fields: Record<string, string> = { type: warning.type };
	if ("feature" in warning && typeof warning.feature === "string") {
		fields.feature = warning.feature;
	}
	if ("setting" in warning && typeof warning.setting === "string") {
		fields.setting = warning.setting;
	}
	return fields;
}

/**
 * Receives the AI SDK's warnings in place of its default of printing each one
 * with `console.warn`. A warning's message can quote the request: the OpenAI
 * provider prints a reasoning part it skips whole, and that part can hold what
 * a model reasoned about a private case. So each warning is logged as its type
 * and feature or setting name only, and its message, details and the warning
 * object itself are never read.
 */
export const logSdkWarnings: LogWarningsFunction = ({
	warnings,
	provider,
	model,
}) => {
	for (const warning of warnings) {
		log.warn("AI SDK warning", { provider, model, ...warningFields(warning) });
	}
};
