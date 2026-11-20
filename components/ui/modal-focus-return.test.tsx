import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { Modal } from "./modal";

// The shared setup swaps Radix Dialog for a stub; focus needs the real one.
vi.mock("@radix-ui/react-dialog", () =>
	vi.importActual("@radix-ui/react-dialog")
);

function Harness() {
	const [open, setOpen] = useState(false);
	const [showOpener, setShowOpener] = useState(true);
	const fallbackRef = useRef<HTMLButtonElement>(null);

	return (
		<>
			<button ref={fallbackRef} type="button">
				Fallback
			</button>
			{showOpener && (
				<button onClick={() => setOpen(true)} type="button">
					Open
				</button>
			)}
			<Modal
				description="Description"
				isOpen={open}
				onClose={() => setOpen(false)}
				returnFocusRef={fallbackRef}
				title="Title"
			>
				<button onClick={() => setShowOpener(false)} type="button">
					Drop opener
				</button>
			</Modal>
		</>
	);
}

describe("Modal focus return", () => {
	it("moves focus to returnFocusRef when the opener has left the page", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<Harness />);

		await user.click(screen.getByRole("button", { name: "Open" }));
		await user.click(screen.getByRole("button", { name: "Drop opener" }));
		expect(screen.queryByRole("button", { name: "Open" })).toBeNull();

		await user.keyboard("{Escape}");

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "Fallback" })
		);
	});
});
