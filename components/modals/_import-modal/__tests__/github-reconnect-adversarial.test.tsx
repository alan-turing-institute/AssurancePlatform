import {
	act,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { GitHubImportTab } from "../github-import-tab";
import { useCaseImport } from "../use-case-import";

/**
 * The import tab's GitHub connection after a refused import. The server may
 * have discarded the stored token while the dialog stayed open, so a 403 makes
 * the dialog ask again whether GitHub is connected: when the token is gone the
 * URL form gives way to the connect button, and when the check itself fails
 * the dialog keeps showing what it already knew.
 */

const { mockCheckGitHub, mockCheckGoogle } = vi.hoisted(() => ({
	mockCheckGitHub: vi.fn(),
	mockCheckGoogle: vi.fn(),
}));

vi.mock("@/actions/integrations", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/actions/integrations")>()),
	checkGitHubAccess: mockCheckGitHub,
	checkGoogleDriveAccess: mockCheckGoogle,
}));

const NO_TOKEN_MESSAGE = "No GitHub token found. Connect your GitHub account.";
const URL_TO_IMPORT = "octo/hello/cases/case.json";

function githubImportReplies(status: number, body: Record<string, unknown>) {
	server.use(
		http.post("/api/cases/import/github", () =>
			HttpResponse.json(body, { status })
		)
	);
}

function refusal(): Record<string, unknown> {
	return { error: NO_TOKEN_MESSAGE, code: "FORBIDDEN" };
}

function renderImportHook() {
	return renderHook(() =>
		useCaseImport({ isOpen: true, onClose: () => undefined })
	);
}

async function renderConnectedHook() {
	const hook = renderImportHook();
	await waitFor(() => expect(hook.result.current.githubConnected).toBe(true));
	return hook;
}

async function importFromGitHub(
	hook: Awaited<ReturnType<typeof renderConnectedHook>>
) {
	await act(async () => {
		await hook.result.current.importFromGitHub(URL_TO_IMPORT);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mockCheckGitHub.mockResolvedValue({ connected: true });
	mockCheckGoogle.mockResolvedValue({
		connected: false,
		needsReauthorisation: false,
	});
});

describe("GitHubImportTab connect button", () => {
	const originalHref = window.location.href;

	afterEach(() => {
		window.location.href = originalHref;
	});

	it("sends the person to the account-linking route, not the general sign-in page", async () => {
		const user = userEvent.setup();
		render(
			<GitHubImportTab
				githubConnected={false}
				importFromGitHub={vi.fn()}
				loading={false}
			/>
		);

		await user.click(screen.getByRole("button"));

		expect(window.location.href).toBe("/api/auth/link/github");
	});

	it("offers the URL form, and no connect button, while connected", () => {
		render(
			<GitHubImportTab
				githubConnected={true}
				importFromGitHub={vi.fn()}
				loading={false}
			/>
		);

		expect(screen.getByLabelText("GitHub URL")).toBeInTheDocument();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(
			screen.getByRole("button", { name: "Import from GitHub" })
		).toBeInTheDocument();
	});
});

describe("useCaseImport — connection re-check after a refused GitHub import", () => {
	it("marks GitHub disconnected when the 403 left no token behind", async () => {
		const hook = await renderConnectedHook();
		githubImportReplies(403, refusal());
		mockCheckGitHub.mockResolvedValue({ connected: false });

		await importFromGitHub(hook);

		expect(hook.result.current.error).toBe(NO_TOKEN_MESSAGE);
		expect(hook.result.current.githubConnected).toBe(false);
		expect(hook.result.current.loading).toBe(false);
	});

	it("stays connected when the 403 was about the repository and the token is still there", async () => {
		const hook = await renderConnectedHook();
		githubImportReplies(403, {
			error: "Access denied. You may not have permission.",
			code: "FORBIDDEN",
		});

		await importFromGitHub(hook);

		expect(mockCheckGitHub).toHaveBeenCalledTimes(2);
		expect(hook.result.current.githubConnected).toBe(true);
		expect(hook.result.current.error).toContain("Access denied");
	});

	it("leaves the connection state unchanged when the re-check fails, and still shows the refusal", async () => {
		const hook = await renderConnectedHook();
		githubImportReplies(403, refusal());
		mockCheckGitHub.mockRejectedValue(new Error("network down"));

		await importFromGitHub(hook);

		expect(hook.result.current.githubConnected).toBe(true);
		expect(hook.result.current.error).toBe(NO_TOKEN_MESSAGE);
		expect(hook.result.current.loading).toBe(false);
	});

	it.each([
		400, 401, 404, 429, 500,
	])("does not re-check after a %i, which says nothing about the token", async (status) => {
		const hook = await renderConnectedHook();
		githubImportReplies(status, { error: "Something else", code: "OTHER" });
		mockCheckGitHub.mockResolvedValue({ connected: false });

		await importFromGitHub(hook);

		expect(mockCheckGitHub).toHaveBeenCalledTimes(1);
		expect(hook.result.current.githubConnected).toBe(true);
		expect(hook.result.current.error).toBe("Something else");
	});

	it("does not re-check after a successful import", async () => {
		const hook = await renderConnectedHook();
		githubImportReplies(200, { id: "case-1", name: "Imported" });

		await importFromGitHub(hook);

		expect(mockCheckGitHub).toHaveBeenCalledTimes(1);
		expect(hook.result.current.githubConnected).toBe(true);
	});

	it("does not re-check GitHub after a refused Google Drive import", async () => {
		const hook = await renderConnectedHook();
		server.use(
			http.post("/api/cases/import/gdrive", () =>
				HttpResponse.json({ error: "Google not connected" }, { status: 403 })
			)
		);
		mockCheckGitHub.mockResolvedValue({ connected: false });

		await act(async () => {
			await hook.result.current.importFromGoogleDrive("file-1");
		});

		expect(mockCheckGitHub).toHaveBeenCalledTimes(1);
		expect(hook.result.current.githubConnected).toBe(true);
	});
});

function ImportTabHarness() {
	const { githubConnected, importFromGitHub, loading, error } = useCaseImport({
		isOpen: true,
		onClose: () => undefined,
	});
	return (
		<div>
			<GitHubImportTab
				githubConnected={githubConnected}
				importFromGitHub={importFromGitHub}
				loading={loading}
			/>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}

async function submitUrlFromTab() {
	const user = userEvent.setup();
	render(<ImportTabHarness />);
	await user.type(await screen.findByLabelText("GitHub URL"), URL_TO_IMPORT);
	await user.click(screen.getByRole("button", { name: "Import from GitHub" }));
}

describe("import tab after a refused import", () => {
	it("swaps the URL form for the connect button when the token is gone", async () => {
		githubImportReplies(403, refusal());
		mockCheckGitHub
			.mockResolvedValueOnce({ connected: true })
			.mockResolvedValue({ connected: false });

		await submitUrlFromTab();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			NO_TOKEN_MESSAGE
		);
		await waitFor(() =>
			expect(screen.queryByLabelText("GitHub URL")).not.toBeInTheDocument()
		);
		expect(screen.getByRole("button")).toBeInTheDocument();
	});

	it("keeps the URL form when the re-check fails", async () => {
		githubImportReplies(403, refusal());
		mockCheckGitHub
			.mockResolvedValueOnce({ connected: true })
			.mockRejectedValue(new Error("network down"));

		await submitUrlFromTab();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			NO_TOKEN_MESSAGE
		);
		expect(screen.getByLabelText("GitHub URL")).toBeInTheDocument();
	});
});
