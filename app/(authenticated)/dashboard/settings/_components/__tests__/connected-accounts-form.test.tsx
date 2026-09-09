import { describe, expect, it } from "vitest";
import type { ConnectedAccountsData } from "@/lib/services/connected-accounts-service";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import {
	ConnectedAccountsForm,
	providerStatus,
} from "../connected-accounts-form";

const ACCESS_REVOKED_REGEX = /access was revoked/i;
const DISCONNECT_BUTTON_REGEX = /disconnect/i;

function makeData(
	overrides: Partial<ConnectedAccountsData["google"]> = {}
): ConnectedAccountsData {
	return {
		canUnlinkGitHub: true,
		canUnlinkGoogle: true,
		github: { connected: false },
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
