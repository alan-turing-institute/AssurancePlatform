import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { IntegrationTokenIssueDialog } from "../integration-token-issue-dialog";

const NO_END_DATE_REGEX = /no end date and keeps working until you revoke it/;

// Where focus lands after a dialog closes is the browser's behaviour and is
// proved end to end; these tests cover the dialog's own state.
function Harness() {
	const [open, setOpen] = useState(false);
	const opener = useRef<HTMLButtonElement>(null);
	return (
		<>
			<button onClick={() => setOpen(true)} ref={opener} type="button">
				Open
			</button>
			<IntegrationTokenIssueDialog
				issuing={false}
				onIssue={() => Promise.resolve(true)}
				onOpenChange={setOpen}
				open={open}
				returnFocusRef={opener}
			/>
		</>
	);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "Open" }));
	await screen.findByRole("dialog", { name: "Issue a new token" });
}

describe("token issue dialog", () => {
	it("describes Go back with the no-end-date warning", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		await openDialog(user);
		await user.click(screen.getByRole("button", { name: "Issue token" }));
		expect(
			await screen.findByRole("button", { name: "Go back" })
		).toHaveAccessibleDescription(NO_END_DATE_REGEX);
	});

	it("moves focus to Go back on the warning step", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		await openDialog(user);
		await user.click(screen.getByRole("button", { name: "Issue token" }));
		expect(
			await screen.findByRole("button", { name: "Go back" })
		).toHaveFocus();
	});

	it("reopens on the form step with an empty date after closing from the warning", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		await openDialog(user);
		await user.type(screen.getByLabelText("End date (optional)"), "2099-01-01");
		await user.clear(screen.getByLabelText("End date (optional)"));
		await user.click(screen.getByRole("button", { name: "Issue token" }));
		await user.click(await screen.findByRole("button", { name: "Go back" }));
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		await openDialog(user);
		expect(screen.getByLabelText("End date (optional)")).toHaveValue("");
		expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
	});
});
