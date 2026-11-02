import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	convertCaseKind,
	fetchConversionConsequences,
} from "@/actions/case-kind";
import { toastSuccess } from "@/lib/toast";
import useStore from "@/store/store";
import ActionButtons from "../action-buttons";
import { CaseKindMenu } from "../case-kind-menu";

vi.mock("@/actions/case-kind", () => ({
	convertCaseKind: vi.fn(),
	fetchConversionConsequences: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
	toast: vi.fn(),
	toastSuccess: vi.fn(),
}));
vi.mock("../case-settings-popover", () => ({
	CaseSettingsPopover: () => null,
}));

const CASE_ID = "00000000-0000-4000-8000-000000000001";

function setCase(kind: "CASE" | "PATTERN", permissions = "manage") {
	useStore.setState({
		assuranceCase: {
			id: CASE_ID,
			name: "Test case",
			type: "assurance-case",
			kind,
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		} as never,
	});
}

beforeEach(() => {
	vi.mocked(convertCaseKind).mockReset();
	vi.mocked(fetchConversionConsequences).mockReset();
	vi.mocked(toastSuccess).mockReset();
	vi.mocked(fetchConversionConsequences).mockResolvedValue({
		success: true,
		data: { people: 2, teams: 0, citingCases: 0 },
	});
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
});

async function openMenu() {
	const user = userEvent.setup();
	await user.click(screen.getByTestId("toolbar-more-actions"));
	return user;
}

describe("CaseKindMenu", () => {
	it("offers to convert a case to a pattern", async () => {
		setCase("CASE");
		render(<CaseKindMenu />);

		await openMenu();

		expect(
			screen.getByRole("menuitem", { name: "Convert to pattern" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("menuitem", { name: "Convert to case" })
		).not.toBeInTheDocument();
	});

	it("offers to convert a pattern back to a case", async () => {
		setCase("PATTERN");
		render(<CaseKindMenu />);

		await openMenu();

		expect(
			screen.getByRole("menuitem", { name: "Convert to case" })
		).toBeInTheDocument();
	});

	it("reads the consequences when the item is chosen and converts only after confirmation", async () => {
		setCase("CASE");
		vi.mocked(convertCaseKind).mockResolvedValue({
			success: true,
			data: { kind: "PATTERN" },
		});
		render(<CaseKindMenu />);

		const user = await openMenu();
		await user.click(
			screen.getByRole("menuitem", { name: "Convert to pattern" })
		);

		expect(
			await screen.findByText(
				"Everyone else it is shared with (2 people) will see a pattern."
			)
		).toBeInTheDocument();
		expect(fetchConversionConsequences).toHaveBeenCalledWith(CASE_ID);
		expect(convertCaseKind).not.toHaveBeenCalled();

		await user.click(
			screen.getByRole("button", { name: "Convert to pattern" })
		);

		await waitFor(() => {
			expect(convertCaseKind).toHaveBeenCalledWith(CASE_ID, "PATTERN");
		});
		await waitFor(() => {
			expect(useStore.getState().assuranceCase?.kind).toBe("PATTERN");
		});
		expect(toastSuccess).toHaveBeenCalledWith("Converted to a pattern");
	});

	it("keeps the dialog open and shows the refusal, leaving the kind alone", async () => {
		setCase("CASE");
		vi.mocked(convertCaseKind).mockResolvedValue({
			success: false,
			error: "Unpublish this case before converting it",
		});
		render(<CaseKindMenu />);

		const user = await openMenu();
		await user.click(
			screen.getByRole("menuitem", { name: "Convert to pattern" })
		);
		await screen.findByText("No copy is kept.");
		await user.click(
			screen.getByRole("button", { name: "Convert to pattern" })
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Unpublish this case before converting it"
		);
		expect(useStore.getState().assuranceCase?.kind).toBe("CASE");
		expect(toastSuccess).not.toHaveBeenCalled();
	});

	it.each([
		[
			"Cancel",
			async (user: UserEvent) => {
				await user.click(screen.getByRole("button", { name: "Cancel" }));
			},
		],
		[
			"Escape",
			async (user: UserEvent) => {
				await user.keyboard("{Escape}");
			},
		],
	])("returns focus to the More actions button when the dialog is closed with %s", async (_label, close) => {
		setCase("CASE");
		render(<CaseKindMenu />);

		const user = await openMenu();
		await user.click(
			screen.getByRole("menuitem", { name: "Convert to pattern" })
		);
		await screen.findByText("No copy is kept.");
		await close(user);

		await waitFor(() => {
			expect(screen.getByTestId("toolbar-more-actions")).toHaveFocus();
		});
	});

	it("keeps the kind it was opened for when someone else converts the case meanwhile", async () => {
		setCase("CASE");
		vi.mocked(convertCaseKind).mockResolvedValue({
			success: false,
			error: "This is already a pattern",
		});
		render(<CaseKindMenu />);

		const user = await openMenu();
		await user.click(
			screen.getByRole("menuitem", { name: "Convert to pattern" })
		);
		await screen.findByText("No copy is kept.");
		act(() => setCase("PATTERN"));

		expect(
			screen.getByText("Convert this case to a pattern?")
		).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Convert to pattern" })
		);

		expect(convertCaseKind).toHaveBeenCalledWith(CASE_ID, "PATTERN");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"This is already a pattern"
		);
		expect(
			screen.getByText("Convert this case to a pattern?")
		).toBeInTheDocument();
	});
});

describe("the toolbar and the convert menu", () => {
	it("shows the menu to someone who manages the case", () => {
		setCase("CASE", "manage");
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);

		expect(screen.getByTestId("toolbar-more-actions")).toBeInTheDocument();
	});

	it.each([
		"view",
		"review",
		"edit",
	])("hides the menu from someone with %s permission", (permissions) => {
		setCase("CASE", permissions);
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);

		expect(
			screen.queryByTestId("toolbar-more-actions")
		).not.toBeInTheDocument();
	});
});
