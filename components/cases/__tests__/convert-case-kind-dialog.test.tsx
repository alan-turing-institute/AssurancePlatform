import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConversionConsequences } from "@/lib/services/case-kind-service";
import { ConvertCaseKindDialog } from "../convert-case-kind-dialog";

const EXPORT_FIRST_PATTERN = /export it first/;

const CASE_CONSEQUENCES: ConversionConsequences = {
	kind: "CASE",
	people: 3,
	teams: 1,
	citingCases: 2,
};

function renderDialog(
	props: Partial<React.ComponentProps<typeof ConvertCaseKindDialog>> = {}
) {
	const onConfirm = vi.fn();
	const onCancel = vi.fn();
	render(
		<ConvertCaseKindDialog
			consequences={CASE_CONSEQUENCES}
			error={null}
			isOpen
			loading={false}
			onCancel={onCancel}
			onConfirm={onConfirm}
			targetKind="PATTERN"
			{...props}
		/>
	);
	return { onCancel, onConfirm };
}

describe("ConvertCaseKindDialog", () => {
	it("states the sharing, plugin and citation consequences and that no copy is kept", () => {
		renderDialog();

		expect(
			screen.getByText("Convert this case to a pattern?")
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Everyone it is shared with (3 people and 1 team) will see a pattern."
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Health plugin checks and integration access grants stay attached to it."
			)
		).toBeInTheDocument();
		expect(
			screen.getByText("2 other cases cite it through away goals or modules.")
		).toBeInTheDocument();
		expect(screen.getByText("No copy is kept.")).toBeInTheDocument();
		expect(screen.getByText(EXPORT_FIRST_PATTERN)).toBeInTheDocument();
	});

	it("says it is not shared when nobody else has access, and uses the singular for one citation", () => {
		renderDialog({
			consequences: { kind: "CASE", people: 0, teams: 0, citingCases: 1 },
		});

		expect(
			screen.getByText("It is not shared with anyone else.")
		).toBeInTheDocument();
		expect(
			screen.getByText("1 other case cites it through away goals or modules.")
		).toBeInTheDocument();
	});

	it("says no other case cites it when none does", () => {
		renderDialog({
			consequences: { kind: "CASE", people: 1, teams: 0, citingCases: 0 },
		});

		expect(
			screen.getByText(
				"No other case cites it through an away goal or a module."
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Everyone it is shared with (1 person) will see a pattern."
			)
		).toBeInTheDocument();
	});

	it("words a conversion back to a case the other way round", () => {
		renderDialog({ targetKind: "CASE" });

		expect(
			screen.getByText("Convert this pattern to a case?")
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Everyone it is shared with (3 people and 1 team) will see a case."
			)
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Convert to case" })
		).toBeInTheDocument();
	});

	it("keeps the confirm button disabled until the consequences have been read", () => {
		renderDialog({ consequences: null });

		expect(
			screen.getByText("Checking who this affects...")
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Convert to pattern" })
		).toBeDisabled();
	});

	it("shows an error and keeps the dialog open for another try", async () => {
		const user = userEvent.setup();
		const { onConfirm } = renderDialog({
			error: "Unpublish this case before converting it",
		});

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unpublish this case before converting it"
		);
		await user.click(
			screen.getByRole("button", { name: "Convert to pattern" })
		);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("confirms and cancels through its two buttons, and blocks both while converting", async () => {
		const user = userEvent.setup();
		const { onCancel, onConfirm } = renderDialog();

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
		await user.click(
			screen.getByRole("button", { name: "Convert to pattern" })
		);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("disables both buttons while the conversion runs", () => {
		renderDialog({ loading: true });

		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Converting..." })
		).toBeDisabled();
	});
});
