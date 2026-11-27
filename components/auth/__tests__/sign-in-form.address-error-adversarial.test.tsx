import { beforeEach, describe, expect, it } from "vitest";
import { mockUseSearchParams } from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import SignInForm from "../sign-in-form";

/**
 * The login page explains a refused provider sign-in only for the one known
 * reason in its address, and never prints text taken from the address.
 */

const MESSAGE = /did not confirm that this email address belongs to you/;
const CREATED = /Account created successfully/;
const MARKUP = "<img src=x onerror=alert(1)>";

function renderWithAddress(query: string) {
	mockUseSearchParams.mockReturnValue(new URLSearchParams(query));
	return renderWithoutProviders(<SignInForm />);
}

beforeEach(() => {
	mockUseSearchParams.mockReturnValue(new URLSearchParams());
});

describe("login page address reasons", () => {
	it("shows the message as an alert for the known reason", async () => {
		renderWithAddress("error=EmailNotVerified");

		expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
	});

	it("shows the message beside the other parameters a redirect can carry", async () => {
		renderWithAddress(
			"callbackUrl=%2Fdashboard&registered=true&error=EmailNotVerified"
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
		expect(screen.getByText(CREATED)).toBeInTheDocument();
	});

	it.each([
		["other capitals", "emailnotverified"],
		["all capitals", "EMAILNOTVERIFIED"],
		["a trailing space", "EmailNotVerified%20"],
		["a leading space", "%20EmailNotVerified"],
		["a suffix", "EmailNotVerified:5"],
		["the empty value", ""],
		["another known reason", "CredentialsSignin"],
		["an unknown reason", "SomethingElse"],
		["markup", encodeURIComponent(MARKUP)],
	])("shows no alert for %s", (_label, value) => {
		renderWithAddress(`error=${value}`);

		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.queryByText(MESSAGE)).toBeNull();
	});

	it("never puts the reason text on the page", () => {
		const { container } = renderWithAddress(
			`error=${encodeURIComponent(MARKUP)}`
		);

		expect(container.innerHTML).not.toContain("onerror");
		expect(container.querySelector("img[src='x']")).toBeNull();
		expect(document.body.textContent).not.toContain("alert(1)");
	});

	it("never puts an address given beside the reason on the page", async () => {
		renderWithAddress("email=leak.check%40example.test&error=EmailNotVerified");

		await screen.findByRole("alert");
		expect(document.body.textContent).not.toContain("leak.check");
	});

	it("reads only the first of a repeated reason", () => {
		renderWithAddress("error=SomethingElse&error=EmailNotVerified");

		expect(screen.queryByRole("alert")).toBeNull();
	});
});
