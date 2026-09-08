import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { DisabledButtonHint } from "./disabled-button-hint";

const CLICK_ME_REGEX = /click me/i;
const REASON = "Only an ACTIVE integration can issue a token";

describe("DisabledButtonHint", () => {
	it("stays reachable by Tab when inert", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(
			<DisabledButtonHint disabled disabledReason={REASON}>
				Click me
			</DisabledButtonHint>
		);

		await user.tab();
		expect(screen.getByRole("button", { name: CLICK_ME_REGEX })).toHaveFocus();
	});

	it("does not call the handler on a mouse click while inert", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		renderWithoutProviders(
			<DisabledButtonHint disabled onClick={onClick}>
				Click me
			</DisabledButtonHint>
		);

		await user.click(screen.getByRole("button", { name: CLICK_ME_REGEX }));
		expect(onClick).not.toHaveBeenCalled();
	});

	it("does not call the handler on Enter while inert", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		renderWithoutProviders(
			<DisabledButtonHint disabled onClick={onClick}>
				Click me
			</DisabledButtonHint>
		);

		await user.tab();
		await user.keyboard("{Enter}");
		expect(onClick).not.toHaveBeenCalled();
	});

	it("does not call the handler on Space while inert", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		renderWithoutProviders(
			<DisabledButtonHint disabled onClick={onClick}>
				Click me
			</DisabledButtonHint>
		);

		await user.tab();
		await user.keyboard(" ");
		expect(onClick).not.toHaveBeenCalled();
	});

	it("calls the handler when enabled", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		renderWithoutProviders(
			<DisabledButtonHint onClick={onClick}>Click me</DisabledButtonHint>
		);

		await user.click(screen.getByRole("button", { name: CLICK_ME_REGEX }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("exposes the disabled reason as the button's accessible description", () => {
		renderWithoutProviders(
			<DisabledButtonHint disabled disabledReason={REASON}>
				Click me
			</DisabledButtonHint>
		);

		expect(
			screen.getByRole("button", { name: CLICK_ME_REGEX })
		).toHaveAccessibleDescription(REASON);
	});

	it("renders no hint span when disabled with no reason given", () => {
		renderWithoutProviders(
			<DisabledButtonHint disabled>Click me</DisabledButtonHint>
		);

		const button = screen.getByRole("button", { name: CLICK_ME_REGEX });
		expect(button).not.toHaveAttribute("aria-describedby");
		expect(button).toHaveAccessibleDescription("");
	});

	it("carries no aria-disabled attribute when enabled", () => {
		renderWithoutProviders(
			<DisabledButtonHint disabledReason={REASON}>
				Click me
			</DisabledButtonHint>
		);

		expect(
			screen.getByRole("button", { name: CLICK_ME_REGEX })
		).not.toHaveAttribute("aria-disabled");
	});

	it("carries the inert styling classes when disabled (button.tsx's aria-disabled: variant)", () => {
		renderWithoutProviders(
			<DisabledButtonHint disabled disabledReason={REASON}>
				Click me
			</DisabledButtonHint>
		);

		expect(screen.getByRole("button", { name: CLICK_ME_REGEX })).toHaveClass(
			"aria-disabled:pointer-events-none",
			"aria-disabled:opacity-50"
		);
	});
});
