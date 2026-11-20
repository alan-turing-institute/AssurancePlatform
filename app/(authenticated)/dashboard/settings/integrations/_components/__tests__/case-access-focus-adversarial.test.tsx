import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseAccessSection } from "../case-access-section";

const GRANT_BUTTON_REGEX = /^grant/i;

const fetchAdministrableCases = vi.hoisted(() => vi.fn());

vi.mock("@/actions/assurance-cases", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/actions/assurance-cases")>()),
	fetchAdministrableCases,
}));

const CASES = [
	{ id: "c1", name: "First case" },
	{ id: "c2", name: "Second case" },
	{ id: "c3", name: "Third case" },
];

const GRANT = "Grant access to a case…";

function view(
	overrides: Partial<Parameters<typeof CaseAccessSection>[0]> = {}
) {
	const props = {
		grantError: null,
		granting: false,
		grants: [],
		integrationActive: true,
		loadError: null,
		loading: false,
		onClearGrantError: vi.fn(),
		onGrant: vi.fn().mockResolvedValue(true),
		onRemove: vi.fn(),
		onRetry: vi.fn(),
		removingCaseId: null,
		...overrides,
	};
	const utils = render(<CaseAccessSection {...props} />);
	return { ...utils, props, user: userEvent.setup() };
}

function grantButton() {
	return screen.getByRole("button", { name: GRANT });
}

function grantForm() {
	return screen.getByRole("form", { name: "Grant access to a case" });
}

beforeEach(() => {
	fetchAdministrableCases.mockReset();
	fetchAdministrableCases.mockResolvedValue(CASES);
});

describe("grant form focus", () => {
	it("moves focus to the named form as it opens, and Tab reaches the picker", async () => {
		const { user } = view();
		await user.click(grantButton());
		expect(grantForm()).toHaveFocus();
		const picker = await screen.findByRole("combobox", { name: "Case" });
		await user.tab();
		expect(picker).toHaveFocus();
	});

	it("opens by keyboard and returns focus to the button on Cancel", async () => {
		const { user } = view();
		grantButton().focus();
		await user.keyboard("{Enter}");
		expect(grantForm()).toHaveFocus();
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(grantButton()).toHaveFocus();
	});

	it("returns focus to the button after a successful grant", async () => {
		const { props, user } = view();
		await user.click(grantButton());
		await user.click(await screen.findByRole("combobox", { name: "Case" }));
		await user.click(
			await screen.findByRole("option", { name: "Second case" })
		);
		await user.click(screen.getByRole("button", { name: GRANT_BUTTON_REGEX }));
		await waitFor(() => expect(grantButton()).toHaveFocus());
		expect(props.onGrant).toHaveBeenCalledExactlyOnceWith("c2", "VIEW");
	});

	it("keeps the form open and does not steal focus when the grant is refused", async () => {
		const { props, user } = view({
			onGrant: vi.fn().mockResolvedValue(false),
		});
		await user.click(grantButton());
		await user.click(await screen.findByRole("combobox", { name: "Case" }));
		await user.click(await screen.findByRole("option", { name: "First case" }));
		const submit = screen.getByRole("button", { name: GRANT_BUTTON_REGEX });
		await user.click(submit);
		await waitFor(() => expect(props.onGrant).toHaveBeenCalled());
		expect(grantForm()).toBeTruthy();
		expect(screen.queryByRole("button", { name: GRANT })).toBeNull();
	});

	it("takes focus back to the button on every one of several open and close cycles", async () => {
		const { user } = view();
		for (let i = 0; i < 5; i++) {
			await user.click(grantButton());
			expect(grantForm()).toHaveFocus();
			await user.click(screen.getByRole("button", { name: "Cancel" }));
			expect(grantButton()).toHaveFocus();
		}
	});

	it("does not pull focus back to the button on a later render", async () => {
		const { props, rerender, user } = view();
		await user.click(grantButton());
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		const outside = document.createElement("button");
		document.body.append(outside);
		outside.focus();
		rerender(<CaseAccessSection {...props} grantError="again" />);
		expect(outside).toHaveFocus();
		outside.remove();
	});

	it("does not focus the button on first render", () => {
		view();
		expect(grantButton()).not.toHaveFocus();
	});

	it("leaves a disabled grant button inert and unopened", async () => {
		const { user } = view({ integrationActive: false });
		grantButton().focus();
		await user.keyboard("{Enter}");
		await user.keyboard(" ");
		expect(screen.queryByRole("form")).toBeNull();
		expect(grantButton()).toHaveAttribute("aria-disabled", "true");
	});

	it("hides cases already granted from the picker", async () => {
		const { user } = view({
			grants: [
				{
					caseId: "c2",
					caseName: "Second case",
					permission: "VIEW",
				},
			] as never,
		});
		await user.click(grantButton());
		await user.click(await screen.findByRole("combobox", { name: "Case" }));
		const names = (await screen.findAllByRole("option")).map((o) =>
			o.textContent?.trim()
		);
		expect(names).toEqual(["First case", "Third case"]);
	});
});
