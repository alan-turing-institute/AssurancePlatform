import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectedAccountsData } from "@/lib/services/connected-accounts-service";
import {
	renderWithoutProviders,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import {
	ConnectedAccountsForm,
	providerStatus,
} from "../connected-accounts-form";

const { unlinkProviderMock, toastMock } = vi.hoisted(() => ({
	unlinkProviderMock: vi.fn(),
	toastMock: vi.fn(),
}));

vi.mock("@/actions/connected-accounts", () => ({
	unlinkProvider: unlinkProviderMock,
}));
vi.mock("@/lib/toast", () => ({ toast: toastMock }));

beforeEach(() => {
	unlinkProviderMock.mockReset();
	toastMock.mockReset();
});

const ACCESS_REVOKED_REGEX = /access was revoked/i;
const DISCONNECT_BUTTON_REGEX = /disconnect/i;
const GITHUB_IMPORT_REGEX = /import from public GitHub/i;
const DRIVE_BACKUPS_REGEX = /Google Drive backups/i;
const NO_PASSWORD_REGEX =
	/No password set - sign in with connected accounts only/;
const KEEP_ACCOUNT_REGEX = /Keep at least one connected account/;

function makeData(
	overrides: Partial<ConnectedAccountsData["google"]> = {}
): ConnectedAccountsData {
	return {
		canUnlinkGitHub: true,
		canUnlinkGoogle: true,
		github: { connected: false, hasImportAccess: false },
		google: {
			connected: true,
			email: "user@example.com",
			hasDriveAccess: false,
			needsReauthorisation: true,
			...overrides,
		},
		hasPassword: true,
		primaryAuthProvider: "LOCAL",
	};
}

const GITHUB_NO_IMPORT_NOTE =
	"Connected for sign-in. To import from GitHub, connect again from Import File.";

describe("ConnectedAccountsForm GitHub note", () => {
	it("explains that import needs a new connection when GitHub is linked without import access", () => {
		renderWithoutProviders(
			<ConnectedAccountsForm
				data={{
					...makeData(),
					github: { connected: true, hasImportAccess: false },
				}}
			/>
		);

		expect(screen.getByText(GITHUB_NO_IMPORT_NOTE)).toBeInTheDocument();
	});

	it("shows no note when GitHub is linked with import access", () => {
		renderWithoutProviders(
			<ConnectedAccountsForm
				data={{
					...makeData(),
					github: { connected: true, hasImportAccess: true },
				}}
			/>
		);

		expect(screen.queryByText(GITHUB_NO_IMPORT_NOTE)).not.toBeInTheDocument();
	});

	it("shows no note when GitHub is not linked", () => {
		renderWithoutProviders(<ConnectedAccountsForm data={makeData()} />);

		expect(screen.queryByText(GITHUB_NO_IMPORT_NOTE)).not.toBeInTheDocument();
	});
});

describe("ConnectedAccountsForm", () => {
	it("shows the needs-re-authorisation state with a Reconnect button when Google's Drive tokens are gone", () => {
		renderWithoutProviders(<ConnectedAccountsForm data={makeData()} />);

		expect(
			screen.getByText("Connected — needs re-authorisation")
		).toBeInTheDocument();
		expect(screen.getByText(ACCESS_REVOKED_REGEX)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Reconnect" })
		).toBeInTheDocument();
		// Disconnect stays available in this state — the identity is still
		// linked, only Drive access needs restoring.
		expect(
			screen.getByRole("button", { name: DISCONNECT_BUTTON_REGEX })
		).toBeInTheDocument();
	});

	it("shows the normal Connected state, with no Reconnect button, when Drive access is healthy", () => {
		renderWithoutProviders(
			<ConnectedAccountsForm
				data={makeData({ hasDriveAccess: true, needsReauthorisation: false })}
			/>
		);

		expect(screen.getByText("user@example.com")).toBeInTheDocument();
		expect(
			screen.queryByText("Connected — needs re-authorisation")
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Reconnect" })
		).not.toBeInTheDocument();
	});
});

const GITHUB_ONLY: ConnectedAccountsData = {
	...makeData({ connected: false, needsReauthorisation: false }),
	github: {
		connected: true,
		hasImportAccess: true,
		username: "alice",
	},
};

describe("ConnectedAccountsForm disconnecting", () => {
	it("renders nothing when there is no account data", () => {
		const { container } = renderWithoutProviders(
			<ConnectedAccountsForm data={null} />
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("shows the GitHub username and a confirmation naming GitHub before disconnecting", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<ConnectedAccountsForm data={GITHUB_ONLY} />);

		expect(screen.getByText("@alice")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Disconnect" }));

		expect(
			await screen.findByRole("button", { name: "Disconnect GitHub" })
		).toBeInTheDocument();
		expect(screen.getByText(GITHUB_IMPORT_REGEX)).toBeInTheDocument();
	});

	it("confirms success with a message when GitHub is disconnected", async () => {
		unlinkProviderMock.mockResolvedValue({ success: true });
		const user = userEvent.setup();
		renderWithoutProviders(<ConnectedAccountsForm data={GITHUB_ONLY} />);

		await user.click(screen.getByRole("button", { name: "Disconnect" }));
		await user.click(
			await screen.findByRole("button", { name: "Disconnect GitHub" })
		);

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				description: "GitHub account disconnected successfully.",
			})
		);
		expect(unlinkProviderMock).toHaveBeenCalledWith("github");
	});

	it("names Google and shows the server's reason when disconnecting fails", async () => {
		unlinkProviderMock.mockResolvedValue({
			success: false,
			error: "Cannot disconnect",
		});
		const user = userEvent.setup();
		renderWithoutProviders(
			<ConnectedAccountsForm
				data={makeData({ hasDriveAccess: true, needsReauthorisation: false })}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Disconnect" }));
		expect(await screen.findByText(DRIVE_BACKUPS_REGEX)).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Disconnect Google" }));

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				description: "Cannot disconnect",
				variant: "destructive",
			})
		);
	});

	it("shows a retry message when the disconnect request throws", async () => {
		unlinkProviderMock.mockRejectedValue(new Error("network"));
		const user = userEvent.setup();
		renderWithoutProviders(<ConnectedAccountsForm data={GITHUB_ONLY} />);

		await user.click(screen.getByRole("button", { name: "Disconnect" }));
		await user.click(
			await screen.findByRole("button", { name: "Disconnect GitHub" })
		);

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith({
				description: "Failed to disconnect account. Please try again.",
				variant: "destructive",
			})
		);
	});

	it("does not disconnect when the confirmation is cancelled", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<ConnectedAccountsForm data={GITHUB_ONLY} />);

		await user.click(screen.getByRole("button", { name: "Disconnect" }));
		await user.click(await screen.findByRole("button", { name: "Cancel" }));

		expect(unlinkProviderMock).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Disconnect GitHub" })
			).not.toBeInTheDocument()
		);
	});

	it("disables Disconnect when the account is the only way to sign in", () => {
		renderWithoutProviders(
			<ConnectedAccountsForm
				data={{ ...GITHUB_ONLY, canUnlinkGitHub: false }}
			/>
		);

		expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
	});
});

describe("ConnectedAccountsForm connecting and password status", () => {
	it("sends the user to the link endpoint for each provider's Connect or Reconnect button", async () => {
		const original = window.location;
		const location = { href: "" };
		Object.defineProperty(window, "location", {
			configurable: true,
			value: location,
		});
		const user = userEvent.setup();
		try {
			renderWithoutProviders(
				<ConnectedAccountsForm
					data={{
						...makeData({ connected: false, needsReauthorisation: false }),
					}}
				/>
			);
			const buttons = screen.getAllByRole("button", { name: "Connect" });
			expect(buttons).toHaveLength(2);

			await user.click(buttons[0] as HTMLElement);
			expect(location.href).toBe("/api/auth/link/github");
			await user.click(buttons[1] as HTMLElement);
			expect(location.href).toBe("/api/auth/link/google");
		} finally {
			Object.defineProperty(window, "location", {
				configurable: true,
				value: original,
			});
		}
	});

	it("starts re-authorisation for Google from the Reconnect button", async () => {
		const original = window.location;
		const location = { href: "" };
		Object.defineProperty(window, "location", {
			configurable: true,
			value: location,
		});
		const user = userEvent.setup();
		try {
			renderWithoutProviders(<ConnectedAccountsForm data={makeData()} />);
			await user.click(screen.getByRole("button", { name: "Reconnect" }));
			expect(location.href).toBe("/api/auth/link/google");
		} finally {
			Object.defineProperty(window, "location", {
				configurable: true,
				value: original,
			});
		}
	});

	it("says password sign-in is enabled when a password is set", () => {
		renderWithoutProviders(<ConnectedAccountsForm data={makeData()} />);

		expect(
			screen.getByText("Password authentication is enabled")
		).toBeInTheDocument();
	});

	it("warns to keep a connected account when no password is set", () => {
		renderWithoutProviders(
			<ConnectedAccountsForm data={{ ...makeData(), hasPassword: false }} />
		);

		expect(screen.getByText(NO_PASSWORD_REGEX)).toBeInTheDocument();
		expect(screen.getByText(KEEP_ACCOUNT_REGEX)).toBeInTheDocument();
	});
});

describe("providerStatus", () => {
	it("returns the warning dot, needs-re-authorisation label, and revocation description when needsReauthorisation is true", () => {
		expect(
			providerStatus({
				connected: true,
				needsReauthorisation: true,
				details: "user@example.com",
			})
		).toEqual({
			dotClass: "bg-warning",
			label: "Connected — needs re-authorisation",
			description:
				"Google reported that access was revoked. Reconnect to restore Drive backup.",
		});
	});

	it("returns the success dot and details (falling back to 'Connected') when connected and healthy", () => {
		expect(
			providerStatus({ connected: true, details: "user@example.com" })
		).toEqual({ dotClass: "bg-success", label: "user@example.com" });
		expect(providerStatus({ connected: true })).toEqual({
			dotClass: "bg-success",
			label: "Connected",
		});
	});

	it("returns the muted dot and 'Not connected' label when not connected", () => {
		expect(providerStatus({ connected: false })).toEqual({
			dotClass: "bg-muted-foreground",
			label: "Not connected",
		});
	});
});
