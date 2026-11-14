"use client";

import { useSyncExternalStore } from "react";

/**
 * The ids of the plugins that were on at the last answer to
 * `GET /api/user/plugins`, kept for the whole browser session. A component
 * that mounts again (a canvas edge, which gets a new id and so a new instance
 * on every case reload) can read it at once, instead of treating every plugin
 * as off until its own request comes back. It is only a first guess: the
 * component's own answer replaces it as soon as that arrives.
 */
let remembered: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>) {
	return a.size === b.size && [...a].every((id) => b.has(id));
}

/** Records which of the answered plugins are on. An unchanged answer keeps the same set and wakes nobody. */
export function rememberEnabledPluginIds(
	plugins: readonly { enabled: boolean; pluginId: string }[]
): void {
	const next = new Set(
		plugins.filter((plugin) => plugin.enabled).map((plugin) => plugin.pluginId)
	);
	if (remembered && sameMembers(remembered, next)) {
		return;
	}
	remembered = next;
	for (const listener of [...listeners]) {
		listener();
	}
}

/** Test-only. Forgets the last answer, so a test does not carry one over from the one before. */
export function forgetEnabledPluginIdsForTests(): void {
	remembered = null;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** The plugin ids that were on at the last answer, or `null` before any answer has come back. */
export function useRememberedEnabledPluginIds(): ReadonlySet<string> | null {
	return useSyncExternalStore(
		subscribe,
		() => remembered,
		() => null
	);
}
