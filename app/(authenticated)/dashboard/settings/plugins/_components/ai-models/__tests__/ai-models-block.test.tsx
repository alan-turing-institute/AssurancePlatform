import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
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

const KEY = "sk-or-test-key-1234567890";
const RATE_LIMIT_MESSAGE = "Too many checks; try again in a few minutes.";

const RADIO_NAMES: Record<string, RegExp> = {
	OpenRouter: /OpenRouter/,
	Anthropic: /Anthropic/,
	Ollama: /Ollama/,
	"OpenAI-compatible": /OpenAI-compatible/,
};
const KEY_FIELD = /^Key/;
const ANY_KEY_INPUT = /key/i;
const NO_KEY_TEXT = /no key$/;
const MODEL_PICKER = /^Model/;
const CLEF_FLASH_LATEST = /clef-flash:latest/;
const OTHER_MODEL_LATEST = /other-model:latest/;
const OPENROUTER_CLEF_FLASH = /cloudflare\/clef-flash/;
const BGE_M3 = /baai\/bge-m3/;

const rateLimited = () =>
	HttpResponse.json(
		{ error: "Too many requests", code: "RATE_LIMITED" },
		{ status: 429 }
	);

async function renderBlock(state: FakeModels = installModelRoutes()) {
	const user = userEvent.setup();
	renderWithoutProviders(<AiModelsBlock />);
	await screen.findByRole("heading", { name: "Quick setup" });
	return { user, state };
}

const job = (name: string) => screen.getByRole("group", { name });

afterEach(() => {
	vi.restoreAllMocks();
});

describe("AiModelsBlock: quick setup", () => {
	it("sends the key, empties the field, lists the jobs still to choose with links, and fills the recommended models", async () => {
		const { user, state } = await renderBlock();

		const field = screen.getByLabelText("OpenRouter key");
		await user.type(field, KEY);
		await user.click(screen.getByRole("button", { name: "Set up" }));

		expect(await screen.findByText("Still to choose:")).toBeInTheDocument();
		expect(requestsTo(state, "POST", "/quick-setup")[0]?.body).toEqual({
			openRouterKey: KEY,
		});
		expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute(
			"href",
			"#ai-models-job-chat"
		);
		expect(
			screen.queryByRole("link", { name: "Ranking" })
		).not.toBeInTheDocument();
		expect(field).toHaveValue("");
		expect(document.body.innerHTML).not.toContain(KEY);

		// The jobs the setup filled in show as set, on the new connection.
		await waitFor(() =>
			expect(job("Ranking")).toHaveTextContent(
				"cloudflare/clef-flash on OpenRouter"
			)
		);
		expect(job("Chat")).toHaveTextContent("Not set");
	});

	it("shows the route's message when the key is refused, and keeps the field for another try", async () => {
		const { user } = await renderBlock();
		server.use(
			http.post("/api/user/models/quick-setup", () =>
				HttpResponse.json(
					{
						error: "The server did not accept the key.",
						code: "UNPROCESSABLE",
					},
					{ status: 422 }
				)
			)
		);

		await user.type(screen.getByLabelText("OpenRouter key"), KEY);
		await user.click(screen.getByRole("button", { name: "Set up" }));

		expect(
			await screen.findByText("The server did not accept the key.")
		).toBeInTheDocument();
		expect(screen.queryByText("Still to choose:")).not.toBeInTheDocument();
		expect(screen.getByLabelText("OpenRouter key")).toHaveValue(KEY);
	});

	it("says to try again later when the limit on checks is reached", async () => {
		const { user } = await renderBlock();
		server.use(http.post("/api/user/models/quick-setup", rateLimited));

		await user.type(screen.getByLabelText("OpenRouter key"), KEY);
		await user.click(screen.getByRole("button", { name: "Set up" }));

		expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
	});
});

describe("AiModelsBlock: connections", () => {
	it("asks for different fields for each connection type", async () => {
		const { user } = await renderBlock();
		await user.click(screen.getByRole("button", { name: "Add connection" }));
		const dialog = await screen.findByRole("dialog");
		const inDialog = within(dialog);

		const fieldsFor = async (type: string) => {
			await user.click(
				inDialog.getByRole("radio", { name: RADIO_NAMES[type] })
			);
			return {
				label: inDialog.queryByLabelText("Label") !== null,
				address: inDialog.queryByLabelText("Address") !== null,
				key: inDialog.queryByLabelText(KEY_FIELD) !== null,
				keyOptional: inDialog.queryByLabelText("Key (optional)") !== null,
			};
		};

		expect(await fieldsFor("OpenRouter")).toEqual({
			label: true,
			address: false,
			key: true,
			keyOptional: false,
		});
		expect(await fieldsFor("Anthropic")).toEqual({
			label: true,
			address: false,
			key: true,
			keyOptional: false,
		});
		expect(await fieldsFor("Ollama")).toEqual({
			label: true,
			address: true,
			key: true,
			keyOptional: true,
		});
		expect(await fieldsFor("OpenAI-compatible")).toEqual({
			label: true,
			address: true,
			key: true,
			keyOptional: true,
		});
	});

	it("adds a connection and shows only whether it has a key", async () => {
		const { user, state } = await renderBlock();
		await user.click(screen.getByRole("button", { name: "Add connection" }));
		const dialog = await screen.findByRole("dialog");
		const inDialog = within(dialog);

		await user.click(inDialog.getByRole("radio", { name: RADIO_NAMES.Ollama }));
		await user.clear(inDialog.getByLabelText("Label"));
		await user.type(inDialog.getByLabelText("Label"), "Lab server");
		await user.type(
			inDialog.getByLabelText("Address"),
			"https://ollama.example.org"
		);
		await user.type(inDialog.getByLabelText("Key (optional)"), KEY);
		await user.click(inDialog.getByRole("button", { name: "Add connection" }));

		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(requestsTo(state, "POST", "/connections")[0]?.body).toEqual({
			type: "OLLAMA",
			label: "Lab server",
			baseUrl: "https://ollama.example.org",
			apiKey: KEY,
		});
		const listed = await screen.findByText(
			"Ollama, https://ollama.example.org, key set"
		);
		expect(listed).toBeInTheDocument();
		expect(document.body.innerHTML).not.toContain(KEY);
	});

	it("shows the route's message inside the dialog when adding fails", async () => {
		const { user } = await renderBlock();
		server.use(
			http.post("/api/user/models/connections", () =>
				HttpResponse.json(
					{
						error: "You can have at most 10 model connections",
						code: "CONFLICT",
					},
					{ status: 409 }
				)
			)
		);
		await user.click(screen.getByRole("button", { name: "Add connection" }));
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Key"), KEY);
		await user.click(
			within(dialog).getByRole("button", { name: "Add connection" })
		);

		expect(
			await within(dialog).findByText(
				"You can have at most 10 model connections"
			)
		).toBeInTheDocument();
		expect(dialog).toBeInTheDocument();
	});

	it("never shows a stored key in the edit dialog, and replaces or removes it on save", async () => {
		const state = installModelRoutes({
			connections: [
				connection({
					id: "local",
					label: "Local",
					type: "OLLAMA",
					hasKey: true,
				}),
			],
		});
		const { user } = await renderBlock(state);

		await user.click(screen.getByRole("button", { name: "Edit" }));
		const dialog = await screen.findByRole("dialog");
		const inDialog = within(dialog);
		expect(
			inDialog.getByText("A key is stored. It is never shown again.")
		).toBeInTheDocument();
		expect(
			inDialog.queryByLabelText(ANY_KEY_INPUT, { selector: "input" })
		).toBeNull();

		await user.click(inDialog.getByRole("button", { name: "Replace key" }));
		await user.type(inDialog.getByLabelText("New key"), "replacement-key");
		await user.click(inDialog.getByRole("button", { name: "Save changes" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(requestsTo(state, "PATCH", "/connections/local")[0]?.body).toEqual({
			apiKey: "replacement-key",
		});

		await user.click(screen.getByRole("button", { name: "Edit" }));
		const again = within(await screen.findByRole("dialog"));
		await user.click(again.getByRole("button", { name: "Remove key" }));
		await user.click(again.getByRole("button", { name: "Save changes" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(requestsTo(state, "PATCH", "/connections/local")[1]?.body).toEqual({
			apiKey: null,
		});
		expect(await screen.findByText(NO_KEY_TEXT)).toBeInTheDocument();
	});

	it("offers no way to remove the key of a type that needs one", async () => {
		const state = installModelRoutes({
			connections: [
				connection({ id: "or", label: "OR", type: "OPENROUTER", hasKey: true }),
			],
		});
		const { user } = await renderBlock(state);

		await user.click(screen.getByRole("button", { name: "Edit" }));
		const dialog = within(await screen.findByRole("dialog"));

		expect(
			dialog.getByRole("button", { name: "Replace key" })
		).toBeInTheDocument();
		expect(dialog.queryByRole("button", { name: "Remove key" })).toBeNull();
	});

	it("shows the route's message after Test, and asks the route once for a connection however often its models are listed", async () => {
		const state = installModelRoutes({
			connections: [connection({ id: "local", label: "Local" })],
			roles: {
				chat: { connectionId: "local", model: "chat-alpha" },
				ranking: null,
				search: null,
				searchCheck: null,
			},
		});
		state.testAnswers.local = {
			ok: false,
			message: "The server did not accept the key.",
			models: { chat: [], ranking: [], search: [] },
		};
		const { user } = await renderBlock(state);

		await user.click(screen.getByRole("button", { name: "Test" }));
		expect(
			await screen.findByText("The server did not accept the key.")
		).toBeInTheDocument();
		expect(requestsTo(state, "POST", "/test")).toHaveLength(1);

		// Opening the chat picker reuses the result: no second call.
		await user.click(
			within(job("Chat")).getByRole("combobox", { name: MODEL_PICKER })
		);
		await user.keyboard("{Escape}");
		await user.click(
			within(job("Chat")).getByRole("combobox", { name: MODEL_PICKER })
		);
		expect(requestsTo(state, "POST", "/test")).toHaveLength(1);
	});

	it("says to try again later when a Test is refused for too many checks", async () => {
		const state = installModelRoutes({
			connections: [connection({ id: "local", label: "Local" })],
		});
		const { user } = await renderBlock(state);
		server.use(http.post("/api/user/models/connections/:id/test", rateLimited));

		await user.click(screen.getByRole("button", { name: "Test" }));

		expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
	});

	it("names the jobs a removal will empty, and empties them when confirmed", async () => {
		const state = installModelRoutes({
			connections: [
				connection({ id: "local", label: "Local" }),
				connection({ id: "other", label: "Other" }),
			],
			roles: {
				chat: { connectionId: "local", model: "llama3" },
				ranking: { connectionId: "local", model: "clef-flash" },
				search: { connectionId: "other", model: "embed" },
				searchCheck: null,
			},
		});
		const { user } = await renderBlock(state);

		const rows = screen.getAllByRole("listitem");
		await user.click(
			within(rows[0] as HTMLElement).getByRole("button", { name: "Remove" })
		);
		const confirm = await screen.findByRole("alertdialog");
		expect(confirm).toHaveTextContent("Remove Local?");
		expect(confirm).toHaveTextContent("empties these jobs: Chat and Ranking");

		await user.click(within(confirm).getByRole("button", { name: "Remove" }));

		await waitFor(() =>
			expect(requestsTo(state, "DELETE", "/connections/local")).toHaveLength(1)
		);
		await waitFor(() => expect(job("Chat")).toHaveTextContent("Not set"));
		expect(job("Ranking")).toHaveTextContent("Not set");
		expect(job("Search")).toHaveTextContent("embed on Other");
	});

	it("says that no job uses a connection when none does", async () => {
		const state = installModelRoutes({
			connections: [connection({ id: "local", label: "Local" })],
		});
		const { user } = await renderBlock(state);

		await user.click(screen.getByRole("button", { name: "Remove" }));

		expect(await screen.findByRole("alertdialog")).toHaveTextContent(
			"No job uses it."
		);
	});
});

describe("AiModelsBlock: the three jobs", () => {
	const everyType = () =>
		installModelRoutes({
			connections: [
				connection({
					id: "or",
					label: "Hosted",
					type: "OPENROUTER",
					hasKey: true,
				}),
				connection({ id: "ol", label: "Local", type: "OLLAMA" }),
				connection({ id: "oa", label: "Vllm", type: "OPENAI_COMPATIBLE" }),
				connection({
					id: "an",
					label: "Claude",
					type: "ANTHROPIC",
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

	it("lists, for each job, only the connections whose type can do it, and Off where the job is optional", async () => {
		const { user } = await renderBlock(everyType());

		expect(await optionsOf(user, "Chat")).toEqual([
			"Hosted (OpenRouter)",
			"Local (Ollama)",
			"Vllm (OpenAI-compatible)",
			"Claude (Anthropic)",
		]);
		expect(await optionsOf(user, "Ranking")).toEqual([
			"Off",
			"Hosted (OpenRouter)",
			"Local (Ollama)",
		]);
		expect(await optionsOf(user, "Search")).toEqual([
			"Off",
			"Hosted (OpenRouter)",
			"Local (Ollama)",
			"Vllm (OpenAI-compatible)",
		]);
	});

	it("saves a chosen connection and a model typed by hand, and sends the other jobs as saved", async () => {
		const state = installModelRoutes({
			connections: [connection({ id: "ol", label: "Local", type: "OLLAMA" })],
			roles: {
				chat: null,
				ranking: { connectionId: "ol", model: "clef-flash" },
				search: null,
				searchCheck: null,
			},
		});
		const { user } = await renderBlock(state);
		const chat = within(job("Chat"));

		await user.click(chat.getByRole("combobox", { name: "Connection" }));
		await user.click(
			await screen.findByRole("option", { name: "Local (Ollama)" })
		);
		await user.click(chat.getByRole("combobox", { name: MODEL_PICKER }));
		await user.type(
			await screen.findByPlaceholderText("Search, or type a model name"),
			"my-own-model"
		);
		await user.click(
			await screen.findByRole("option", { name: 'Use "my-own-model"' })
		);
		await user.click(chat.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(requestsTo(state, "PUT", "/roles")).toHaveLength(1)
		);
		expect(requestsTo(state, "PUT", "/roles")[0]?.body).toEqual({
			chat: { connectionId: "ol", model: "my-own-model" },
			ranking: { connectionId: "ol", model: "clef-flash" },
			search: null,
		});
		await waitFor(() =>
			expect(job("Chat")).toHaveTextContent("my-own-model on Local")
		);
	});

	it("marks the recommended model, also when the connection lists it with a :latest tag", async () => {
		const state = installModelRoutes({
			connections: [connection({ id: "ol", label: "Local", type: "OLLAMA" })],
			roles: {
				chat: null,
				ranking: { connectionId: "ol", model: "other-model" },
				search: null,
				searchCheck: null,
			},
		});
		state.testAnswers.ol = {
			ok: true,
			message: "The connection works.",
			models: {
				chat: [],
				ranking: ["other-model:latest", "clef-flash:latest"],
				search: [],
			},
		};
		const { user } = await renderBlock(state);

		await user.click(
			within(job("Ranking")).getByRole("combobox", { name: MODEL_PICKER })
		);

		const recommended = await screen.findByRole("option", {
			name: CLEF_FLASH_LATEST,
		});
		expect(recommended).toHaveTextContent("Recommended");
		expect(
			screen.getByRole("option", { name: OTHER_MODEL_LATEST })
		).not.toHaveTextContent("Recommended");
	});

	it("offers the recommended model even when the connection's list does not include it", async () => {
		const state = installModelRoutes({
			connections: [
				connection({
					id: "or",
					label: "Hosted",
					type: "OPENROUTER",
					hasKey: true,
				}),
			],
			roles: {
				chat: { connectionId: "or", model: "chat-alpha" },
				ranking: { connectionId: "or", model: "rank-alpha" },
				search: null,
				searchCheck: null,
			},
		});
		const { user } = await renderBlock(state);

		await user.click(
			within(job("Ranking")).getByRole("combobox", { name: MODEL_PICKER })
		);

		expect(
			await screen.findByRole("option", { name: OPENROUTER_CLEF_FLASH })
		).toHaveTextContent("Recommended");
	});
});

describe("AiModelsBlock: the search job's status", () => {
	const searchJob = { connectionId: "or", model: "baai/bge-m3" };
	const withSearch = (
		searchCheck: { verifiedAt: string; verifiedFor: string } | null
	) =>
		installModelRoutes({
			connections: [
				connection({
					id: "or",
					label: "Hosted",
					type: "OPENROUTER",
					hasKey: true,
				}),
			],
			roles: {
				chat: null,
				ranking: null,
				search: searchJob,
				searchCheck,
			},
		});

	it("says search is not set", async () => {
		await renderBlock(installModelRoutes());

		expect(job("Search")).toHaveTextContent("Not set");
		expect(
			within(job("Search")).queryByRole("button", { name: "Check again" })
		).toBeNull();
	});

	it("says the check passed", async () => {
		await renderBlock(
			withSearch({ verifiedAt: "2026-01-01T00:00:00.000Z", verifiedFor: "x" })
		);

		expect(job("Search")).toHaveTextContent("Check passed");
		expect(
			within(job("Search")).queryByRole("button", { name: "Check again" })
		).toBeNull();
	});

	it("says the check has not passed when the page opens on a search job with no pass, and offers Check again", async () => {
		await renderBlock(withSearch(null));

		expect(job("Search")).toHaveTextContent("Check not passed");
		expect(job("Search")).toHaveTextContent(
			"No check has passed for this model yet."
		);
		expect(
			within(job("Search")).getByRole("button", { name: "Check again" })
		).toBeEnabled();
	});

	it("shows the lowest similarity after a check that fails, then passes on Check again", async () => {
		const state = installModelRoutes({
			connections: [
				connection({
					id: "or",
					label: "Hosted",
					type: "OPENROUTER",
					hasKey: true,
				}),
			],
			roles: { chat: null, ranking: null, search: null, searchCheck: null },
		});
		state.nextSearchCheck = { ok: false, lowestCosine: 0.6234 };
		const { user } = await renderBlock(state);
		const search = within(job("Search"));

		await user.click(search.getByRole("combobox", { name: "Connection" }));
		await user.click(
			await screen.findByRole("option", { name: "Hosted (OpenRouter)" })
		);
		await user.click(search.getByRole("combobox", { name: MODEL_PICKER }));
		await user.click(await screen.findByRole("option", { name: BGE_M3 }));
		await user.click(search.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(job("Search")).toHaveTextContent("Check not passed")
		);
		expect(job("Search")).toHaveTextContent("Lowest similarity 0.62");

		state.nextSearchCheck = { ok: true, lowestCosine: 0.999 };
		await user.click(search.getByRole("button", { name: "Check again" }));

		await waitFor(() =>
			expect(job("Search")).toHaveTextContent("Check passed")
		);
		// Check again saves the jobs as they are: the search job is sent unchanged.
		const sent = requestsTo(state, "PUT", "/roles");
		expect(sent).toHaveLength(2);
		expect(sent[1]?.body).toEqual({
			chat: null,
			ranking: null,
			search: searchJob,
		});
	});

	it("says the check could not run when the search service gave no test sentences", async () => {
		const state = withSearch(null);
		state.nextSearchCheck = { unavailable: true };
		const { user } = await renderBlock(state);

		await user.click(
			within(job("Search")).getByRole("button", { name: "Check again" })
		);

		await waitFor(() =>
			expect(job("Search")).toHaveTextContent("the check could not run")
		);
		expect(job("Search")).toHaveTextContent("Check not passed");
	});

	it("says the answers could not be compared when the check found no similarity", async () => {
		const state = withSearch(null);
		state.nextSearchCheck = { ok: false, lowestCosine: null };
		const { user } = await renderBlock(state);

		await user.click(
			within(job("Search")).getByRole("button", { name: "Check again" })
		);

		await waitFor(() =>
			expect(job("Search")).toHaveTextContent("could not be compared")
		);
	});

	it("says to try again later when Check again is refused for too many checks", async () => {
		const { user } = await renderBlock(withSearch(null));
		server.use(http.put("/api/user/models/roles", rateLimited));

		await user.click(
			within(job("Search")).getByRole("button", { name: "Check again" })
		);

		expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
	});
});

describe("AiModelsBlock: opening at its anchor", () => {
	it("scrolls into view when the page was opened at #ai-models", async () => {
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
		scroll.mockClear();
		window.location.hash = "#ai-models";

		await renderBlock();

		expect(scroll).toHaveBeenCalledTimes(1);
		window.location.hash = "";
	});

	it("does not scroll without the anchor", async () => {
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
		scroll.mockClear();
		window.location.hash = "";

		await renderBlock();

		expect(scroll).not.toHaveBeenCalled();
	});
});
