import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import RegisterForm from "../register-form";
import ResetPasswordForm from "../reset-password-form";
import SignInForm from "../sign-in-form";

vi.mock("@/actions/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/actions/auth")>()),
	validatePasswordResetToken: vi
		.fn()
		.mockResolvedValue({ valid: true, email: "alice@example.test" }),
}));

const TOGGLE_NAME = /^(show|hide) password$/i;

interface Box {
	form: string;
	label: string;
	/** Which of the form's show-password buttons belongs to this box. */
	position: number;
	render: () => Promise<void> | void;
}

function renderSignIn() {
	renderWithoutProviders(<SignInForm />);
}

function renderRegister() {
	renderWithoutProviders(<RegisterForm />);
}

async function renderReset() {
	mockUseSearchParams.mockReturnValue(new URLSearchParams("token=link-token"));
	renderWithoutProviders(<ResetPasswordForm />);
	await screen.findByRole("heading", { name: "Reset your password" });
}

const BOXES: Box[] = [
	{ form: "sign-in", label: "Password", position: 0, render: renderSignIn },
	{ form: "register", label: "Password", position: 0, render: renderRegister },
	{
		form: "register",
		label: "Confirm Password",
		position: 1,
		render: renderRegister,
	},
	{ form: "reset", label: "New password", position: 0, render: renderReset },
	{
		form: "reset",
		label: "Confirm new password",
		position: 1,
		render: renderReset,
	},
];

const CASES = BOXES.map((box) => [`${box.form} / ${box.label}`, box] as const);

function boxOf(box: Box): HTMLInputElement {
	const input = screen.getByLabelText(box.label, { exact: true });
	if (!(input instanceof HTMLInputElement)) {
		throw new Error(`${box.label} is not an input`);
	}
	return input;
}

function toggleOf(box: Box): HTMLElement {
	const buttons = screen.getAllByRole("button", {
		name: TOGGLE_NAME,
	});
	const button = buttons[box.position];
	if (!button) {
		throw new Error(`no show-password button at ${box.position}`);
	}
	return button;
}

describe.each(CASES)("password box %s", (_name, box) => {
	beforeEach(() => {
		resetNavigationMocks();
		mockUseSearchParams.mockReturnValue(new URLSearchParams());
	});

	it("is found by its label and is a password input", async () => {
		await box.render();

		const input = boxOf(box);

		expect(input).toHaveAttribute("type", "password");
		expect(input).toHaveAccessibleName(box.label);
	});

	it("takes focus when its label text is clicked", async () => {
		await box.render();
		const user = userEvent.setup();

		await user.click(screen.getByText(box.label, { exact: true }));

		expect(boxOf(box)).toHaveFocus();
	});

	it("has a show-password button that is a named, plain, tabbable button", async () => {
		await box.render();

		const toggle = toggleOf(box);

		expect(toggle).toHaveAccessibleName("Show password");
		expect(toggle).toHaveAttribute("type", "button");
		expect(toggle.tabIndex).toBeGreaterThanOrEqual(0);
		expect(toggle).toBeEnabled();
	});

	it("is followed in tab order by its own show-password button", async () => {
		await box.render();
		const user = userEvent.setup();

		boxOf(box).focus();
		await user.tab();

		expect(toggleOf(box)).toHaveFocus();
	});

	it("shows the text, flips the button name and keeps the value on toggle", async () => {
		await box.render();
		const user = userEvent.setup();
		await user.type(boxOf(box), "Passw0rd!x");

		await user.click(toggleOf(box));

		expect(boxOf(box)).toHaveAttribute("type", "text");
		expect(boxOf(box)).toHaveValue("Passw0rd!x");
		expect(toggleOf(box)).toHaveAccessibleName("Hide password");

		await user.click(toggleOf(box));

		expect(boxOf(box)).toHaveAttribute("type", "password");
		expect(toggleOf(box)).toHaveAccessibleName("Show password");
	});

	it("toggles by keyboard without submitting the form", async () => {
		await box.render();
		const user = userEvent.setup();
		toggleOf(box).focus();

		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(boxOf(box)).toHaveAttribute("type", "text");
		});
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("leaves a sibling password box hidden when this one is shown", async () => {
		await box.render();
		const user = userEvent.setup();

		await user.click(toggleOf(box));

		const siblings = BOXES.filter(
			(other) => other.form === box.form && other.label !== box.label
		);
		for (const sibling of siblings) {
			expect(boxOf(sibling)).toHaveAttribute("type", "password");
		}
	});
});
