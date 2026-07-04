"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { fetchPlugins } from "@/hooks/use-plugin-enablement";
import { DEFAULT_BAND_SCORES, type HealthBand } from "./health-bands";

const PLUGIN_ID = "tea.health";

/**
 * Mirrors `health-scoring-service.ts`'s (private) `scoringSettingsSchema`
 * for the one field the badge needs — `verdictScores`. Kept as an
 * independent, narrower schema rather than imported, for the same reason
 * `DEFAULT_BAND_SCORES` is duplicated in `health-bands.ts`: that module
 * imports `@/lib/prisma` and is server-only.
 */
const bandScoresSettingsSchema = z.object({
	verdictScores: z
		.object({
			PASS: z.number().min(0).max(1).optional(),
			DEGRADED: z.number().min(0).max(1).optional(),
			FAIL: z.number().min(0).max(1).optional(),
		})
		.optional(),
});

function resolveBandScores(settings: unknown): Record<HealthBand, number> {
	const parsed = bandScoresSettingsSchema.safeParse(settings ?? {});
	const verdictScores = parsed.success ? parsed.data.verdictScores : undefined;
	return {
		fail: verdictScores?.FAIL ?? DEFAULT_BAND_SCORES.fail,
		degraded: verdictScores?.DEGRADED ?? DEFAULT_BAND_SCORES.degraded,
		pass: verdictScores?.PASS ?? DEFAULT_BAND_SCORES.pass,
	};
}

/**
 * The badge's band thresholds, sourced from the SAME `tea.health`
 * `PluginState.settings` blob `health-scoring-service.ts`'s
 * `resolveScoringSettings` reads server-side for scoring — never a second,
 * independent settings surface (delegation brief: "score→band via plugin
 * settings ... bands NOT hardcoded in schema"). Reuses `fetchPlugins()`
 * (`hooks/use-plugin-enablement.ts`) rather than inventing a second fetch
 * mechanism — its in-flight de-dupe already exists for exactly this "many
 * slot instances read the same settings response" shape (the vincent
 * finding that motivated it in the first place).
 *
 * Falls back field-by-field to `DEFAULT_BAND_SCORES` exactly as the server
 * does, so an unset or partially-set settings blob behaves identically on
 * both sides. A failed fetch or malformed settings both degrade to the
 * defaults, never a crash — this is display-only; the actual score
 * computation already went through the server's own equally-defensive
 * parse.
 */
export function useHealthBandScores(): Record<HealthBand, number> {
	const [bandScores, setBandScores] =
		useState<Record<HealthBand, number>>(DEFAULT_BAND_SCORES);

	useEffect(() => {
		let cancelled = false;

		fetchPlugins()
			.then((plugins) => {
				if (cancelled) {
					return;
				}
				const entry = plugins.find((p) => p.pluginId === PLUGIN_ID);
				setBandScores(resolveBandScores(entry?.settings));
			})
			.catch(() => {
				if (!cancelled) {
					setBandScores(DEFAULT_BAND_SCORES);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return bandScores;
}
