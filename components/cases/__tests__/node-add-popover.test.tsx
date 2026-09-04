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

// Focus restoration (review follow-up, PR #885 G3, fixed): NodeAddPopover
// now wires its `children` through `<PopoverTrigger asChild>` instead of
// `<PopoverAnchor>`. Radix's modal PopoverContent restores focus via
// `context.triggerRef.current?.focus()`, and `context.triggerRef` is
// populated exclusively by `<PopoverTrigger>` — `<PopoverAnchor>` is purely a
// popper positioning primitive and never touched it, which is why focus
// used to go nowhere on dismiss.
//
// What the test below actually proves under jsdom: pre-fix,
// `document.activeElement` ends up on `<body>` after Escape (nothing left to
// hold focus); post-fix it's back on the trigger — so the assertion
// discriminates the regression. That is not the same claim as "Radix's
// triggerRef restore is exercised here" — jsdom's focus handling doesn't
// reproduce the browser's own focus-trap/tab-order semantics closely enough
// to stand as proof of the mechanism itself. The real source of truth is
// browser behaviour: focus moves into the popover content on open and
// returns to the trigger on Escape, an outside click, or selecting an
// option. That is what would need checking in a real browser to confirm
// the mechanism itself, not just this regression indicator.
describe("NodeAddPopover — trigger survives a dismiss cycle and regains focus", () => {
	it("leaves the trigger mounted and reusable after dismissing via Escape", async () => {
		const user = userEvent.setup();
		render(<ControlledHarness />);

		const trigger = screen.getByRole("button", { name: "Add child element" });
		await user.click(trigger);
		await screen.findByText("Add Element");

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => {
			expect(screen.queryByText("Add Element")).not.toBeInTheDocument();
		});
		expect(trigger).toBeInTheDocument();

		// Reopening still works — the dismiss cycle didn't leave the trigger
		// (or its wiring to `open`/`onOpenChange`) in a broken state.
		await user.click(trigger);
		await waitFor(() => {
			expect(screen.getByText("Add Element")).toBeInTheDocument();
		});
	});

	it("returns keyboard focus to the trigger after dismissing with Escape", async () => {
		const user = userEvent.setup();
		render(<ControlledHarness />);

		const trigger = screen.getByRole("button", { name: "Add child element" });
		await user.click(trigger);
		await screen.findByText("Add Element");

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => {
			expect(screen.queryByText("Add Element")).not.toBeInTheDocument();
		});
		await waitFor(() => {
			expect(document.activeElement).toBe(trigger);
		});
	});
});
