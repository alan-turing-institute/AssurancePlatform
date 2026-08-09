import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Node } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import NodeAddPopover from "../node-add-popover";

// The repo-wide Radix mocks (src/__tests__/setup/component-mocks.tsx) are
// simplified state containers that don't implement real dismiss behaviour
// (outside click / Escape), so this file needs the actual primitive — the
// dismiss-behaviour tests below would be false-green against the mock.
vi.unmock("@radix-ui/react-popover");

const NODE: Node = {
	id: "1",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: 1, name: "G1" },
};

// NodeAddPopover's `open` is externally controlled — every real caller
// (goal-node.tsx, strategy-node.tsx, property-node.tsx) owns the boolean in
// its own local state and flips it from the trigger's onClick, rather than
// letting Radix manage open state itself. This harness reproduces that
// wiring instead of driving `open` as a prop directly, since that's the
// shape the bug actually manifests under.
function DismissHarness() {
	const [open, setOpen] = useState(true);
	return (
		<div>
			{/* Stands in for ReactFlow's pane: d3-zoom attaches native
			 * pointerdown/mousedown handlers there that stop propagation for
			 * its own pan-gesture handling. */}
			<div data-testid="canvas-pane">canvas</div>
			<NodeAddPopover
				node={NODE}
				nodeType="goal"
				onOpenChange={setOpen}
				open={open}
			>
				<button type="button">Add child element</button>
			</NodeAddPopover>
		</div>
	);
}

// Starts closed, so the trigger's onClick (not the `open` prop) is what
// drives the popover open — the same wiring `DismissHarness` above uses,
// just starting from the closed state so opening-via-trigger and
// selecting-an-option-closes-it can both be exercised.
function ControlledHarness() {
	const [open, setOpen] = useState(false);
	return (
		<NodeAddPopover
			node={NODE}
			nodeType="goal"
			onOpenChange={setOpen}
			open={open}
		>
			<button onClick={() => setOpen(true)} type="button">
				Add child element
			</button>
		</NodeAddPopover>
	);
}

describe("NodeAddPopover — dismiss on outside click / Escape", () => {
	it("closes on Escape", async () => {
		render(<DismissHarness />);

		await screen.findByText("Add Element");

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => {
			expect(screen.queryByText("Add Element")).not.toBeInTheDocument();
		});
	});

	it("closes on an outside click even when the click target stops event propagation — the exact ReactFlow-canvas scenario that defeats a non-modal popover", async () => {
		render(<DismissHarness />);
		const pane = screen.getByTestId("canvas-pane");
		pane.addEventListener("pointerdown", (e) => e.stopPropagation());
		pane.addEventListener("mousedown", (e) => e.stopPropagation());

		await screen.findByText("Add Element");

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
			expect(screen.queryByText("Add Element")).not.toBeInTheDocument();
		});
	});
});

describe("NodeAddPopover — controlled open/onOpenChange still works under modal", () => {
	it("opens via the external trigger and closes when an option is selected", async () => {
		const user = userEvent.setup();
		render(<ControlledHarness />);

		expect(screen.queryByText("Add Element")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Add child element" }));
		await screen.findByText("Add Element");

		await user.click(screen.getByRole("button", { name: "Add Strategy" }));

		await waitFor(() => {
			expect(screen.queryByText("Add Element")).not.toBeInTheDocument();
		});
	});
});
