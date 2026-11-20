import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { resetPluginFetchDedupeForTests } from "@/hooks/use-plugin-enablement";
import { server } from "@/src/__tests__/mocks/server";
import { usePluginSettings } from "../use-plugin-settings";

function deferred() {
	let resolve: () => void = () => {
		/* replaced when the promise is created */
	};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

afterEach(() => {
	resetPluginFetchDedupeForTests();
});

describe("usePluginSettings", () => {
	it("keeps the first plugin saving while a second finishes first", async () => {
		const gates = new Map([
			["tea.first", deferred()],
			["tea.second", deferred()],
		]);
		server.use(
			http.get("/api/user/plugins", () => HttpResponse.json({ plugins: [] })),
			http.patch("/api/user/plugins", async ({ request }) => {
				const { pluginId } = (await request.json()) as { pluginId: string };
				await gates.get(pluginId)?.promise;
				return HttpResponse.json({});
			})
		);
		const { result } = renderHook(() => usePluginSettings());
		await waitFor(() => expect(result.current.loading).toBe(false));

		let firstDone: Promise<void> = Promise.resolve();
		let secondDone: Promise<void> = Promise.resolve();
		act(() => {
			firstDone = result.current.togglePlugin("tea.first", true);
			secondDone = result.current.togglePlugin("tea.second", true);
		});
		expect([...result.current.togglingIds].sort()).toEqual([
			"tea.first",
			"tea.second",
		]);

		gates.get("tea.second")?.resolve();
		await act(async () => {
			await secondDone;
		});

		expect([...result.current.togglingIds]).toEqual(["tea.first"]);

		gates.get("tea.first")?.resolve();
		await act(async () => {
			await firstDone;
		});

		expect(result.current.togglingIds.size).toBe(0);
	});
});
