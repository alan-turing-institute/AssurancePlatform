import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import { resetPluginFetchDedupeForTests } from "../use-plugin-enablement";
import { usePluginSettings } from "../use-plugin-settings";

interface Deferred {
	promise: Promise<void>;
	resolve: () => void;
}

function deferred(): Deferred {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function plugin(pluginId: string): PluginSettingsListItem {
	return {
		pluginId,
		name: pluginId,
		version: "0.1.0",
		description: "Test plugin description.",
		docsPath: undefined,
		surfaces: [],
		available: true,
		enabled: false,
		pinnedAt: null,
		settings: null,
	} as PluginSettingsListItem;
}

// Each PATCH waits on the gate registered for its plugin id.
function serve(gates: Record<string, Deferred>, failing: string[] = []) {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({ plugins: [plugin("a"), plugin("b")] })
		),
		http.patch("/api/user/plugins", async ({ request }) => {
			const body = (await request.json()) as { pluginId: string };
			await gates[body.pluginId]?.promise;
			return failing.includes(body.pluginId)
				? HttpResponse.json({ error: "nope" }, { status: 500 })
				: HttpResponse.json({ ok: true });
		})
	);
}

type Hook = ReturnType<
	typeof renderHook<ReturnType<typeof usePluginSettings>, unknown>
>;

async function mounted(): Promise<Hook> {
	const hook = renderHook(() => usePluginSettings());
	await waitFor(() => expect(hook.result.current.loading).toBe(false));
	return hook;
}

function start(hook: Hook, ids: string[]) {
	act(() => {
		for (const id of ids) {
			hook.result.current.togglePlugin(id, true).catch(() => undefined);
		}
	});
}

function release(gate: Deferred) {
	act(() => {
		gate.resolve();
	});
}

async function expectSaving(hook: Hook, expected: string[]) {
	await waitFor(() =>
		expect([...hook.result.current.togglingIds].sort()).toEqual(expected)
	);
}

afterEach(() => {
	resetPluginFetchDedupeForTests();
});

describe("usePluginSettings togglingIds", () => {
	it("is empty before any toggle", async () => {
		serve({});
		const hook = await mounted();
		expect(hook.result.current.togglingIds.size).toBe(0);
	});

	it("keeps the first plugin saving after the second finishes first", async () => {
		const gates = { a: deferred(), b: deferred() };
		serve(gates);
		const hook = await mounted();

		start(hook, ["a", "b"]);
		await expectSaving(hook, ["a", "b"]);
		release(gates.b);
		await expectSaving(hook, ["a"]);
		release(gates.a);
		await expectSaving(hook, []);
	});

	it("clears only the failed plugin when its request errors first", async () => {
		const gates = { a: deferred(), b: deferred() };
		serve(gates, ["b"]);
		const hook = await mounted();

		start(hook, ["a", "b"]);
		await expectSaving(hook, ["a", "b"]);
		release(gates.b);
		await expectSaving(hook, ["a"]);
		release(gates.a);
		await expectSaving(hook, []);
	});

	it("does not mutate a set it has already handed out", async () => {
		const gates = { a: deferred() };
		serve(gates);
		const hook = await mounted();

		start(hook, ["a"]);
		await expectSaving(hook, ["a"]);
		const snapshot = hook.result.current.togglingIds;
		release(gates.a);
		await expectSaving(hook, []);
		expect(snapshot.has("a")).toBe(true);
	});
});
