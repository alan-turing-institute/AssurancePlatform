import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { GrantCaseAccessForm } from "../grant-case-access-form";

const NONE_YET_REGEX = /you don't administer any cases yet/i;
const ALL_GRANTED_REGEX = /every case you administer already has this/i;
const LOADING_REGEX = /loading your cases/i;
const CASE_COMBOBOX_REGEX = /^case$/i;
const SUBMIT_REGEX = /^grant access$/i;

const { administrable, everyCase } = vi.hoisted(() => ({
	administrable: vi.fn(),
	everyCase: vi.fn(),
}));

vi.mock("@/actions/assurance-cases", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/actions/assurance-cases")>()),
	fetchAdministrableCases: administrable,
	fetchAssuranceCases: everyCase,
}));

beforeEach(() => {
	administrable.mockReset();
	everyCase.mockReset();
	everyCase.mockResolvedValue([{ id: "not-administered", name: "Not mine" }]);
});

function renderForm(
	props: Partial<React.ComponentProps<typeof GrantCaseAccessForm>> = {}
) {
	const onGrant = vi.fn().mockResolvedValue(true);
	renderWithoutProviders(
		<GrantCaseAccessForm
			existingCaseIds={[]}
			grantError={null}
			granting={false}
			onCancel={vi.fn()}
			onGrant={onGrant}
			{...props}
		/>
	);
	return { onGrant };
}

async function optionNames() {
	const user = userEvent.setup();
	await user.click(screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX }));
	return screen.getAllByRole("option").map((option) => option.textContent);
}

function secondOption(name: string) {
	const [, second] = screen.getAllByRole("option", { name });
	if (!second) {
		throw new Error(`expected two options named ${name}`);
	}
	return second;
}

describe("GrantCaseAccessForm case list", () => {
	it("offers the cases the administrable-cases action returns, in its order, and no others", async () => {
		administrable.mockResolvedValue([
			{ id: "b", name: "Second" },
			{ id: "a", name: "First" },
		]);
		renderForm();

		await screen.findByRole("combobox", { name: CASE_COMBOBOX_REGEX });

		expect(await optionNames()).toEqual(["Second", "First"]);
		expect(everyCase).not.toHaveBeenCalled();
	});

	it("leaves out a case the integration is already granted, and keeps the rest", async () => {
		administrable.mockResolvedValue([
			{ id: "a", name: "Granted" },
			{ id: "b", name: "Not yet" },
		]);
		renderForm({ existingCaseIds: ["a"] });

		await screen.findByRole("combobox", { name: CASE_COMBOBOX_REGEX });

		expect(await optionNames()).toEqual(["Not yet"]);
	});

	it("grants the case that was picked when two cases share a name", async () => {
		administrable.mockResolvedValue([
			{ id: "first-id", name: "Same name" },
			{ id: "second-id", name: "Same name" },
		]);
		const { onGrant } = renderForm();
		const user = userEvent.setup();
		await screen.findByRole("combobox", { name: CASE_COMBOBOX_REGEX });

		await user.click(
			screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
		);
		await user.click(secondOption("Same name"));
		await user.click(screen.getByRole("button", { name: SUBMIT_REGEX }));

		expect(onGrant).toHaveBeenCalledWith("second-id", "VIEW");
	});
});

describe("GrantCaseAccessForm empty states", () => {
	it("says the person administers no case when the list is empty, and offers no picker", async () => {
		administrable.mockResolvedValue([]);
		renderForm();

		expect(await screen.findByText(NONE_YET_REGEX)).toBeInTheDocument();

		expect(screen.queryByText(ALL_GRANTED_REGEX)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: CASE_COMBOBOX_REGEX })
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: SUBMIT_REGEX })).toBeDisabled();
	});

	it("says every case is granted, not that there are none, when each listed case is granted", async () => {
		administrable.mockResolvedValue([
			{ id: "a", name: "One" },
			{ id: "b", name: "Two" },
		]);
		renderForm({ existingCaseIds: ["a", "b"] });

		expect(await screen.findByText(ALL_GRANTED_REGEX)).toBeInTheDocument();

		expect(screen.queryByText(NONE_YET_REGEX)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: CASE_COMBOBOX_REGEX })
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: SUBMIT_REGEX })).toBeDisabled();
	});

	it("shows neither message while the list is still loading, and then only the right one", async () => {
		let resolveList: (rows: { id: string; name: string }[]) => void = () => {
			/* replaced when the promise is created */
		};
		administrable.mockReturnValue(
			new Promise((resolve) => {
				resolveList = resolve;
			})
		);
		renderForm();

		expect(screen.getByText(LOADING_REGEX)).toBeInTheDocument();
		expect(screen.queryByText(NONE_YET_REGEX)).not.toBeInTheDocument();
		expect(screen.queryByText(ALL_GRANTED_REGEX)).not.toBeInTheDocument();

		resolveList([]);

		expect(await screen.findByText(NONE_YET_REGEX)).toBeInTheDocument();
		expect(screen.queryByText(LOADING_REGEX)).not.toBeInTheDocument();
		expect(screen.queryByText(ALL_GRANTED_REGEX)).not.toBeInTheDocument();
	});

	it("offers no case and does not fail when the action returns null", async () => {
		administrable.mockResolvedValue(null);
		renderForm();

		await waitFor(() =>
			expect(screen.queryByText(LOADING_REGEX)).not.toBeInTheDocument()
		);

		expect(
			screen.queryByRole("combobox", { name: CASE_COMBOBOX_REGEX })
		).not.toBeInTheDocument();
		expect(screen.queryByText(ALL_GRANTED_REGEX)).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: SUBMIT_REGEX })).toBeDisabled();
	});
});
