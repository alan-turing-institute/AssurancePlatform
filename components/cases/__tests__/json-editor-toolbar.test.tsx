import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LayoutControlsProps } from "../json-editor-toolbar";
import { JsonEditorToolbar } from "../json-editor-toolbar";

function baseLayout(overrides: Partial<LayoutControlsProps> = {}) {
	return {
		formatDisabled: false,
		isFullScreen: false,
		onFormat: vi.fn(),
		onToggleFullScreen: vi.fn(),
		onToggleWrap: vi.fn(),
		wrapEnabled: false,
		...overrides,
	};
}

function baseProps(layoutOverrides: Partial<LayoutControlsProps> = {}) {
	return {
		copied: false,
		copyDisabled: false,
		diffResult: null,
		errorCount: 0,
		formatVersion: null as string | null,
		hasConflict: false,
		isApplying: false,
		isDirty: false,
		isValid: true,
		layout: baseLayout(layoutOverrides),
		onApply: vi.fn(),
		onCopy: vi.fn(),
		onDiscard: vi.fn(),
		onRefresh: vi.fn(),
	};
}

describe("JsonEditorToolbar — format version", () => {
	it("shows the format version badge when provided, and none when it's unknown", () => {
		const { rerender } = render(
			<JsonEditorToolbar {...baseProps()} formatVersion="1.0" />
		);
		expect(screen.getByText("v1.0")).toBeInTheDocument();

		rerender(<JsonEditorToolbar {...baseProps()} formatVersion={null} />);
		expect(screen.queryByText("v1.0")).not.toBeInTheDocument();
	});
});

describe("JsonEditorToolbar — full-screen toggle", () => {
	it("calls onToggleFullScreen when clicked, and reflects state via aria-pressed", async () => {
		const user = userEvent.setup();
		const onToggleFullScreen = vi.fn();
		render(
			<JsonEditorToolbar
				{...baseProps({ isFullScreen: false, onToggleFullScreen })}
			/>
		);

		const button = screen.getByRole("button", { name: "Enter full screen" });
		expect(button).toHaveAttribute("aria-pressed", "false");

		await user.click(button);

		expect(onToggleFullScreen).toHaveBeenCalledTimes(1);
	});

	it("shows the exit label and pressed state once full-screen", () => {
		render(<JsonEditorToolbar {...baseProps({ isFullScreen: true })} />);

		const button = screen.getByRole("button", { name: "Exit full screen" });
		expect(button).toHaveAttribute("aria-pressed", "true");
	});

	it("forwards a ref to the full-screen button so focus can return to it", () => {
		const ref = { current: null as HTMLButtonElement | null };
		render(<JsonEditorToolbar {...baseProps({ fullScreenButtonRef: ref })} />);

		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
		expect(ref.current).toHaveAttribute("aria-label", "Enter full screen");
	});
});

describe("JsonEditorToolbar — wrap toggle", () => {
	it("calls onToggleWrap when clicked, and reflects state via aria-pressed", async () => {
		const user = userEvent.setup();
		const onToggleWrap = vi.fn();
		render(
			<JsonEditorToolbar {...baseProps({ onToggleWrap, wrapEnabled: false })} />
		);

		const button = screen.getByRole("button", { name: "Enable line wrap" });
		expect(button).toHaveAttribute("aria-pressed", "false");

		await user.click(button);

		expect(onToggleWrap).toHaveBeenCalledTimes(1);
	});

	it("shows the disable label once wrap is on", () => {
		render(<JsonEditorToolbar {...baseProps({ wrapEnabled: true })} />);

		expect(
			screen.getByRole("button", { name: "Disable line wrap" })
		).toHaveAttribute("aria-pressed", "true");
	});
});

describe("JsonEditorToolbar — format button", () => {
	it("calls onFormat when clicked", async () => {
		const user = userEvent.setup();
		const onFormat = vi.fn();
		render(<JsonEditorToolbar {...baseProps({ onFormat })} />);

		await user.click(screen.getByRole("button", { name: "Format JSON" }));

		expect(onFormat).toHaveBeenCalledTimes(1);
	});

	it("is disabled when the buffer can't be pretty-printed", () => {
		render(<JsonEditorToolbar {...baseProps({ formatDisabled: true })} />);

		expect(screen.getByRole("button", { name: "Format JSON" })).toBeDisabled();
	});
});

// Apply's isDirty/isValid gating is pre-existing logic this change didn't
// touch (canApply's formula doesn't reference any of the new layout props),
// and it's covered at the level where the behaviour actually lives —
// hooks/__tests__/use-json-validation.test.ts, which proves the Zod gate
// still blocks a document the JSON Schema's own checks wouldn't catch. A
// toolbar-level "Apply is disabled when isValid is false" test can't fail
// on anything this PR changes, so it isn't duplicated here.
