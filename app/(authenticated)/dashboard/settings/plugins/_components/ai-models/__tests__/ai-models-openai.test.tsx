import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
	waitFor,
	within,
} from "@/src/__tests__/utils/test-utils";
import { AiModelsBlock } from "../ai-models-block";
import {
	connection,
	type FakeModels,
	installModelRoutes,
	requestsTo,
} from "./model-routes-fake";

/** An OpenAI connection on the AI models settings: no address, a required key, chat only. */

const KEY = "sk-openai-test-key-1234567890";
const KEY_FIELD = /^Key/;
const OLLAMA_ADDRESS = "https://ollama.example.org";

async function renderBlock(state: FakeModels = installModelRoutes()) {
	const user = userEvent.setup();
	renderWithoutProviders(<AiModelsBlock />);
	await screen.findByRole("heading", { name: "Quick setup" });
	return { user, state };
}

async function openAddDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "Add connection" }));
	return within(await screen.findByRole("dialog"));
}

const job = (name: string) => screen.getByRole("group", { name });

describe("adding an OpenAI connection", () => {
	it("asks for a label and a key only, requires the key, and sends no address", async () => {
		const { user, state } = await renderBlock();
		const dialog = await openAddDialog(user);

		await user.click(dialog.getByRole("radio", { name: "OpenAI" }));

		expect(dialog.getByLabelText("Label")).toHaveValue("OpenAI");
		expect(dialog.queryByLabelText("Address")).toBeNull();
		expect(dialog.getByLabelText(KEY_FIELD)).toBeInTheDocument();
		expect(dialog.queryByLabelText("Key (optional)")).toBeNull();
		const add = dialog.getByRole("button", { name: "Add connection" });
		expect(add).toBeDisabled();

		await user.type(dialog.getByLabelText("Key"), KEY);
		expect(add).toBeEnabled();
		await user.click(add);

		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(requestsTo(state, "POST", "/connections")[0]?.body).toEqual({
			type: "OPENAI",
			label: "OpenAI",
			apiKey: KEY,
		});
		expect(await screen.findByText("OpenAI, key set")).toBeInTheDocument();
		expect(document.body.innerHTML).not.toContain(KEY);
		expect(document.body.innerHTML).not.toContain("api.openai.com");
	});

	it("sends no address that was typed for another type before switching to OpenAI", async () => {
		const { user, state } = await renderBlock();
		const dialog = await openAddDialog(user);

		await user.click(dialog.getByRole("radio", { name: "Ollama" }));
		await user.type(dialog.getByLabelText("Address"), OLLAMA_ADDRESS);
		await user.click(dialog.getByRole("radio", { name: "OpenAI" }));
		await user.type(dialog.getByLabelText("Key"), KEY);
		await user.click(dialog.getByRole("button", { name: "Add connection" }));

		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		const sent = requestsTo(state, "POST", "/connections")[0]?.body;
		expect(sent).toEqual({ type: "OPENAI", label: "OpenAI", apiKey: KEY });
	});

	it("still asks for an address on OpenAI-compatible, which is a different choice from OpenAI", async () => {
		const { user } = await renderBlock();
		const dialog = await openAddDialog(user);

		await user.click(dialog.getByRole("radio", { name: "OpenAI-compatible" }));

		expect(dialog.getByLabelText("Address")).toBeInTheDocument();
		expect(dialog.getByLabelText("Key (optional)")).toBeInTheDocument();
	});
});

describe("an OpenAI connection in the settings", () => {
	const withOpenAi = () =>
		installModelRoutes({
			connections: [
				connection({
					id: "or",
					label: "Hosted",
					type: "OPENROUTER",
					hasKey: true,
				}),
				connection({
					id: "ai",
					label: "Work OpenAI",
					type: "OPENAI",
					hasKey: true,
				}),
			],
		});

	async function optionsOf(
		user: ReturnType<typeof userEvent.setup>,
		name: string
	) {
		const trigger = within(job(name)).getByRole("combobox", {
			name: "Connection",
		});
		await user.click(trigger);
		const listed = screen
			.getAllByRole("option")
			.map((option) => option.textContent);
		await user.click(trigger);
		await waitFor(() =>
			expect(screen.queryAllByRole("option")).toHaveLength(0)
		);
		return listed;
	}

	it("is offered for chat and not for ranking or search", async () => {
		const { user } = await renderBlock(withOpenAi());

		expect(await optionsOf(user, "Chat")).toEqual([
			"Hosted (OpenRouter)",
			"Work OpenAI (OpenAI)",
		]);
		expect(await optionsOf(user, "Ranking")).toEqual([
			"Off",
			"Hosted (OpenRouter)",
		]);
		expect(await optionsOf(user, "Search")).toEqual([
			"Off",
			"Hosted (OpenRouter)",
		]);
	});

	it("shows the type and whether a key is set, without an address", async () => {
		await renderBlock(withOpenAi());

		expect(screen.getByText("OpenAI, key set")).toBeInTheDocument();
		expect(document.body.innerHTML).not.toContain("api.openai.com");
	});

	it("offers to replace the key but not to remove it, and has no address to edit", async () => {
		const { user } = await renderBlock(withOpenAi());

		const buttons = screen.getAllByRole("button", { name: "Edit" });
		await user.click(buttons[1] as HTMLElement);
		const dialog = within(await screen.findByRole("dialog"));

		expect(
			dialog.getByText("Change the label, or replace the key.")
		).toBeInTheDocument();
		expect(dialog.queryByLabelText("Address")).toBeNull();
		expect(
			dialog.getByRole("button", { name: "Replace key" })
		).toBeInTheDocument();
		expect(dialog.queryByRole("button", { name: "Remove key" })).toBeNull();
	});

	it("sends only the changed label when it is renamed, and no address", async () => {
		const { user, state } = await renderBlock(withOpenAi());

		const buttons = screen.getAllByRole("button", { name: "Edit" });
		await user.click(buttons[1] as HTMLElement);
		const dialog = within(await screen.findByRole("dialog"));
		await user.clear(dialog.getByLabelText("Label"));
		await user.type(dialog.getByLabelText("Label"), "Renamed");
		await user.click(dialog.getByRole("button", { name: "Save changes" }));

		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(requestsTo(state, "PATCH", "/connections/ai")[0]?.body).toEqual({
			label: "Renamed",
		});
	});
});
