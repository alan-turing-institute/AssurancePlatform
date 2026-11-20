import { describe, expect, it } from "vitest";
import type { ConnectedAccountsData } from "@/lib/services/connected-accounts-service";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { ConnectedAccountsForm } from "../connected-accounts-form";

const NOTE =
	"Connected for sign-in. To import from GitHub, connect again from Import File.";
const PAST = new Date(Date.now() - 60 * 60 * 1000);

function dataWith(
	github: ConnectedAccountsData["github"],
	google: Partial<ConnectedAccountsData["google"]> = {}
): ConnectedAccountsData {
	return {
		canUnlinkGitHub: true,
		canUnlinkGoogle: true,
		github,
		google: {
			connected: false,
			hasDriveAccess: false,
			needsReauthorisation: false,
			...google,
		},
		hasPassword: true,
		primaryAuthProvider: "LOCAL",
	};
}

function show(data: ConnectedAccountsData) {
	renderWithoutProviders(<ConnectedAccountsForm data={data} />);
}

describe("the GitHub import note", () => {
	it("shows once, under GitHub, for an expired token", () => {
		show(
			dataWith({
				connected: true,
				hasImportAccess: false,
				tokenExpiry: PAST,
				username: "alice",
			})
		);

		const notes = screen.getAllByText(NOTE);

		expect(notes).toHaveLength(1);
		expect(notes[0]?.parentElement).toHaveTextContent("GitHub");
		expect(notes[0]?.parentElement).not.toHaveTextContent("Google");
	});

	it("does not show for a user with import access even with an old expiry date", () => {
		show(
			dataWith({ connected: true, hasImportAccess: true, tokenExpiry: PAST })
		);

		expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
	});

	it("is not added to a connected Google card that needs re-authorisation", () => {
		show(
			dataWith(
				{ connected: false, hasImportAccess: false },
				{ connected: true, needsReauthorisation: true, email: "a@b.test" }
			)
		);

		expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
	});

	it("does not stop GitHub offering Disconnect", () => {
		show(dataWith({ connected: true, hasImportAccess: false }));

		expect(
			screen.getByRole("button", { name: "Disconnect" })
		).toBeInTheDocument();
	});
});
