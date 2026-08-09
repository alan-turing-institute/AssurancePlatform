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

// Focus restoration (review follow-up, PR #885 G3): NOT the same regression
// vector here as the other modal popovers. Radix's modal PopoverContent only
// restores focus via `context.triggerRef.current?.focus()` — and
// `context.triggerRef` is populated exclusively by `<PopoverTrigger>`.
// NodeAddPopover wires its `children` through `<PopoverAnchor>` instead (the
// component is externally controlled — every real caller, e.g. goal-node.tsx,
// opens it from its own `onClick`, not Radix's), which is purely a popper
// positioning primitive and never touches `triggerRef`. So
// `triggerRef.current` stays `null` for the lifetime of this component, the
// optional-chained `.focus()` call is a no-op, and — because
// `onCloseAutoFocus` also calls `event.preventDefault()` unconditionally —
// FocusScope's own "focus the previously-focused element" fallback never
// runs either. Net effect: dismissing this popover restores focus to
// nothing; the browser's default (the focused node was removed) takes over.
//
// Verified this is a real behavioural fact, not a jsdom limitation: an
// identical harness against QuickEditPopover (components/docs/curriculum/
// enhanced/dialogs/quick-edit-popover.tsx — a real `<PopoverTrigger>`) DOES
// land focus back on its trigger button under jsdom. Asserting "focus
// returns to the trigger" against NodeAddPopover would therefore be
// asserting something the component doesn't do — a test that's always
// falsely red, not a true regression guard. Per the brief: documenting why
// here rather than shipping either a false-failing test or a vacuous one
// that asserts nothing meaningful. The alternative locked in below is the
// one thing that IS true and worth guarding: the trigger stays mounted,
// unbroken and re-clickable after a dismiss cycle (no stale-ref crash, no
// focus trap on a removed node). Wiring `<PopoverTrigger>` properly (so
// focus restoration starts working) is production code and out of scope for
// this test-only commit — worth a follow-up issue.
describe("NodeAddPopover — trigger survives a dismiss cycle (focus restoration does not apply — see comment above)", () => {
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
});
