import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppearanceSubject, ElementAppearance } from "@/lib/plugins/slots";
import { elementAppearanceSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import {
	useEdgeAppearance,
	useNodeAppearance,
} from "../use-element-appearance";
import { resetPluginFetchDedupeForTests } from "../use-plugin-enablement";

const POSITIVE: ElementAppearance = { tone: "positive", faded: false };

interface ProviderCall {
	enabled: boolean;
	subject: AppearanceSubject;
}

const calls: ProviderCall[] = [];

function useFakeProvider(subject: AppearanceSubject, enabled: boolean) {
	calls.push({ subject, enabled });
	return POSITIVE;
}

function mockPlugins(enabled: boolean, gate?: Promise<void>) {
	server.use(
		http.get("/api/user/plugins", async () => {
			await gate;
			return HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "Claim/Evidence Health",
						version: "0.1.0",
						description: "Test plugin description.",
						docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
						surfaces: [],
						available: true,
						enabled,
						pinnedAt: enabled ? null : "USER",
						settings: null,
					},
				] satisfies PluginSettingsListItem[],
			});
		})
	);
}

function NodeHost() {
	const appearance = useNodeAppearance("e-1", "evidence");
	return (
		<output data-testid="node-answer">
			{appearance ? `${appearance.tone}` : "none"}
		</output>
	);
}

function EdgeHost() {
	const appearance = useEdgeAppearance("claim-1", "e-1");
	return (
		<output data-testid="edge-answer">
			{appearance ? `${appearance.tone}` : "none"}
		</output>
	);
}

afterEach(() => {
	calls.length = 0;
	elementAppearanceSlot.resetForTests();
	resetPluginFetchDedupeForTests();
	useStore.setState({ assuranceCase: null, readOnlyCanvas: false });
	vi.restoreAllMocks();
});

describe("the element-appearance hooks", () => {
	it("answer nothing when no plugin has registered, so the canvas draws as before", async () => {
		mockPlugins(true);

		render(<NodeHost />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("node-answer")).toBeVisible()
		);
		expect(screen.getByTestId("node-answer")).toHaveTextContent("none");
	});

	it("pass an enabled plugin's answer to the node, asking about the node and the case on the canvas", async () => {
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: useFakeProvider,
		});
		useStore.setState({
			assuranceCase: { id: "case-7" } as never,
		});
		mockPlugins(true);

		render(<NodeHost />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("node-answer")).toHaveTextContent("positive")
		);
		expect(calls.at(-1)).toEqual({
			enabled: true,
			subject: {
				kind: "node",
				caseId: "case-7",
				elementId: "e-1",
				elementType: "evidence",
			},
		});
	});

	it("ask an edge about the two elements it joins", async () => {
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: useFakeProvider,
		});
		mockPlugins(true);

		render(<EdgeHost />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("edge-answer")).toHaveTextContent("positive")
		);
		expect(calls.at(-1)?.subject).toEqual({
			kind: "edge",
			caseId: "",
			sourceElementId: "claim-1",
			targetElementId: "e-1",
		});
	});

	it("still call a disabled plugin's hook, with enabled false, and ignore what it returns", async () => {
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: useFakeProvider,
		});
		mockPlugins(false);

		render(<NodeHost />, { withProviders: false });

		await waitFor(() => expect(calls.some((call) => !call.enabled)).toBe(true));
		await waitFor(() =>
			expect(screen.getByTestId("node-answer")).toHaveTextContent("none")
		);
		expect(calls.every((call) => !call.enabled)).toBe(true);
	});

	it("tell every plugin it is off, and fetch no plugin list, on the read-only documentation canvas", async () => {
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: useFakeProvider,
		});
		let listRequests = 0;
		server.use(
			http.get("/api/user/plugins", () => {
				listRequests += 1;
				return HttpResponse.json({ plugins: [] });
			})
		);
		useStore.setState({ readOnlyCanvas: true });

		render(<NodeHost />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("node-answer")).toHaveTextContent("none")
		);
		expect(calls.length).toBeGreaterThan(0);
		expect(calls.every((call) => !call.enabled)).toBe(true);
		expect(listRequests).toBe(0);
	});

	describe("for an edge that mounts again after the plugin list has been answered once", () => {
		function register() {
			elementAppearanceSlot.register({
				pluginId: "tea.health",
				useAppearance: useFakeProvider,
			});
		}

		async function answeredOnce(enabled: boolean) {
			mockPlugins(enabled);
			const first = render(<EdgeHost />, { withProviders: false });
			await waitFor(() =>
				expect(screen.getByTestId("edge-answer")).toHaveTextContent(
					enabled ? "positive" : "none"
				)
			);
			await waitFor(() => expect(calls.at(-1)?.enabled).toBe(enabled));
			first.unmount();
		}

		it("answers from the last known list at once, before its own request comes back", async () => {
			register();
			await answeredOnce(true);
			let release: () => void = () => undefined;
			mockPlugins(
				true,
				new Promise<void>((resolve) => {
					release = resolve;
				})
			);
			calls.length = 0;

			render(<EdgeHost />, { withProviders: false });

			expect(screen.getByTestId("edge-answer")).toHaveTextContent("positive");
			expect(calls.every((call) => call.enabled)).toBe(true);

			release();
			await waitFor(() =>
				expect(screen.getByTestId("edge-answer")).toHaveTextContent("positive")
			);
			expect(calls.every((call) => call.enabled)).toBe(true);
		});

		it("lets its own answer replace the last known list when the plugin has since been turned off", async () => {
			register();
			await answeredOnce(true);
			let release: () => void = () => undefined;
			mockPlugins(
				false,
				new Promise<void>((resolve) => {
					release = resolve;
				})
			);

			render(<EdgeHost />, { withProviders: false });
			expect(screen.getByTestId("edge-answer")).toHaveTextContent("positive");

			release();
			await waitFor(() =>
				expect(screen.getByTestId("edge-answer")).toHaveTextContent("none")
			);
		});

		it("still waits for its own answer when no list has been answered before", () => {
			register();
			mockPlugins(true, new Promise<void>(() => undefined));

			render(<EdgeHost />, { withProviders: false });

			expect(screen.getByTestId("edge-answer")).toHaveTextContent("none");
			expect(calls.every((call) => !call.enabled)).toBe(true);
		});

		it("is never told a plugin is on, on the read-only documentation canvas", async () => {
			register();
			await answeredOnce(true);
			useStore.setState({ readOnlyCanvas: true });
			calls.length = 0;

			render(<EdgeHost />, { withProviders: false });

			await waitFor(() =>
				expect(screen.getByTestId("edge-answer")).toHaveTextContent("none")
			);
			expect(calls.length).toBeGreaterThan(0);
			expect(calls.every((call) => !call.enabled)).toBe(true);
		});
	});

	it("take the first enabled plugin that answers", async () => {
		const first = { pluginId: "tea.first", useAppearance: () => null };
		const second = {
			pluginId: "tea.second",
			useAppearance: () => ({ tone: "negative", faded: true }) as const,
		};
		const third = {
			pluginId: "tea.third",
			useAppearance: () => ({ tone: "caution", faded: false }) as const,
		};
		vi.spyOn(elementAppearanceSlot, "list").mockReturnValue([
			first,
			second,
			third,
		]);
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: ["tea.first", "tea.second", "tea.third"].map((pluginId) => ({
						pluginId,
						name: pluginId,
						version: "0.1.0",
						description: "Test plugin description.",
						surfaces: [],
						available: true,
						enabled: true,
						pinnedAt: null,
						settings: null,
					})),
				})
			)
		);

		render(<NodeHost />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("node-answer")).toHaveTextContent("negative")
		);
	});
});
