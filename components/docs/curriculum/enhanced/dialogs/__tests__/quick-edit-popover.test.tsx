import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickEditPopover } from "../quick-edit-popover";

// The repo-wide Radix mocks (src/__tests__/setup/component-mocks.tsx) are
// simplified state containers that don't implement real dismiss behaviour
// (outside click / Escape), so this file needs the actual primitive — the
// dismiss-behaviour tests below would be false-green against the mock.
vi.unmock("@radix-ui/react-popover");

// Stands in for ReactFlow's pane: d3-zoom attaches native
// pointerdown/mousedown handlers there that stop propagation for its own
// pan-gesture handling — the same wiring node-action-toolbar.tsx sits inside
// of via enhanced-interactive-case-viewer.tsx's canvas.
function Harness({ onSave = vi.fn() }: { onSave?: (value: string) => void }) {
	return (
		<div>
			<div data-testid="canvas-pane">canvas</div>
			<QuickEditPopover
				description="Existing description"
				isDarkMode={false}
				onSave={onSave}
			/>
		</div>
	);
}

async function openPopover(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button"));
	await screen.findByLabelText("Description");
}

describe("QuickEditPopover — dismiss on outside click / Escape", () => {
	it("closes on Escape", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await openPopover(user);

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => {
			expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
		});
	});

	it("closes on an outside click even when the click target stops event propagation — the exact ReactFlow-canvas scenario that defeats a non-modal popover", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const pane = screen.getByTestId("canvas-pane");
		pane.addEventListener("pointerdown", (e) => e.stopPropagation());
		pane.addEventListener("mousedown", (e) => e.stopPropagation());

		await openPopover(user);

		// `modal` sets `document.body.style.pointerEvents = "none"` while
		// open, so a real click over the canvas never reaches `pane` at all —
		// confirm that's actually in effect, then dispatch where the click
		// would really land (fireEvent skips CSS hit-testing, unlike a real
		// browser or user-event, so the redirect is simulated explicitly).
		expect(document.body.style.pointerEvents).toBe("none");
		fireEvent.pointerDown(document.body);
		fireEvent.mouseDown(document.body);
		fireEvent.mouseUp(document.body);
		fireEvent.click(document.body);

		await waitFor(() => {
			expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
		});
	});
});

describe("QuickEditPopover — controlled open/onOpenChange still works under modal", () => {
	it("opens via the trigger and closes again on Save, calling onSave with the edited value", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		render(<Harness onSave={onSave} />);

		expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();

		await openPopover(user);

		const textarea = screen.getByLabelText("Description");
		await user.clear(textarea);
		await user.type(textarea, "Updated description");

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
		});
		expect(onSave).toHaveBeenCalledWith("Updated description");
	});

	it("opens via the trigger and closes again on Cancel without calling onSave", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		render(<Harness onSave={onSave} />);

		await openPopover(user);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
		});
		expect(onSave).not.toHaveBeenCalled();
	});
});
