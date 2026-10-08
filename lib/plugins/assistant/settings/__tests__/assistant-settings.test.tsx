import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AssistantSettings } from "../assistant-settings";

const PLUGIN = {
	pluginId: "tea.assistant",
	name: "Case Assistant",
	version: "0.1.0",
	description: "d",
	surfaces: ["settings-section"],
	available: true,
	enabled: true,
	pinnedAt: null,
};

function serve(opts: { hasKey: boolean; settings: unknown }) {
	const writes: { method: string; body: unknown; url: string }[] = [];
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [{ ...PLUGIN, settings: opts.settings }],
			})
		),
		http.get("/api/user/plugins/assistant/options", () =>
			HttpResponse.json({ baseUrls: ["https://llm.internal/v1"] })
		),
		http.get("/api/user/plugins/assistant/key", () =>
			HttpResponse.json({ hasKey: opts.hasKey })
		),
		http.patch("/api/user/plugins", async ({ request }) => {
			writes.push({
				method: "PATCH",
				url: "plugins",
				body: await request.json(),
			});
			return HttpResponse.json({});
		}),
		http.put("/api/user/plugins/assistant/key", async ({ request }) => {
			writes.push({ method: "PUT", url: "key", body: await request.json() });
			return HttpResponse.json({ hasKey: true });
		}),
		http.delete("/api/user/plugins/assistant/key", () => {
			writes.push({ method: "DELETE", url: "key", body: null });
			return HttpResponse.json({ hasKey: false });
		})
	);
	return writes;
}

describe("AssistantSettings", () => {
	it("shows a key input and hides the base URL for the Anthropic provider", async () => {
		serve({ hasKey: false, settings: null });
		renderWithoutProviders(<AssistantSettings pluginId="tea.assistant" />);
		expect(await screen.findByLabelText("Provider")).toBeInTheDocument();
		expect(screen.getByLabelText("Model name")).toBeInTheDocument();
		expect(screen.getByLabelText("API key")).toHaveAttribute(
			"type",
			"password"
		);
		expect(screen.queryByLabelText("Base URL")).not.toBeInTheDocument();
	});

	it("saves provider, base URL and model through the plugin settings route", async () => {
		const writes = serve({
			hasKey: false,
			settings: {
				provider: "openai-compatible",
				baseUrl: "https://llm.internal/v1",
				model: "old",
			},
		});
		const user = userEvent.setup();
		renderWithoutProviders(<AssistantSettings pluginId="tea.assistant" />);
		const model = await screen.findByLabelText("Model name");
		expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
		await user.clear(model);
		await user.type(model, "new-model");
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(writes).toHaveLength(1));
		expect(writes[0]?.body).toEqual({
			pluginId: "tea.assistant",
			enabled: true,
			settings: {
				provider: "openai-compatible",
				baseUrl: "https://llm.internal/v1",
				model: "new-model",
			},
		});
	});

	it("writes a key without echoing it back, then offers replace and remove", async () => {
		const writes = serve({ hasKey: false, settings: null });
		const user = userEvent.setup();
		renderWithoutProviders(<AssistantSettings pluginId="tea.assistant" />);
		await user.type(await screen.findByLabelText("API key"), "sk-abc");
		await user.click(screen.getByRole("button", { name: "Save key" }));
		expect(await screen.findByText("A key is set")).toBeInTheDocument();
		expect(writes[0]).toMatchObject({ method: "PUT", body: { key: "sk-abc" } });
		expect(screen.queryByDisplayValue("sk-abc")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Remove" }));
		expect(await screen.findByLabelText("API key")).toBeInTheDocument();
		expect(writes[1]?.method).toBe("DELETE");
	});

	it("shows the key as set when one exists, with replace and remove", async () => {
		serve({ hasKey: true, settings: null });
		renderWithoutProviders(<AssistantSettings pluginId="tea.assistant" />);
		expect(await screen.findByText("A key is set")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
		expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
	});
});
