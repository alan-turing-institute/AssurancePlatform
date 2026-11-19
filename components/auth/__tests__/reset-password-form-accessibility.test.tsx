import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import ResetPasswordForm from "../reset-password-form";

vi.mock("@/actions/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/actions/auth")>()),
	validatePasswordResetToken: vi
		.fn()
		.mockResolvedValue({ valid: true, email: "alice@example.test" }),
}));

const STRENGTH_RULES =
	"Must be at least 8 characters with one uppercase letter, one number, and one special character.";
const STRONG_PASSWORD = "StrongP@ss1";
const REFUSAL = "Invalid or expired reset token";
const CONNECTION_ERROR =
	"Connection error. Please check your internet and try again.";
const NEW_PASSWORD_LABEL = "New password";
const CONFIRM_PASSWORD_LABEL = "Confirm new password";

type User = ReturnType<typeof userEvent.setup>;
interface Boxes {
	first: HTMLElement;
	second: HTMLElement;
}

function inputNamed(container: HTMLElement, name: string): HTMLElement {
	const input = container.querySelector<HTMLElement>(`input[name="${name}"]`);
	if (!input) {
		throw new Error(`no input named ${name}`);
	}
	return input;
}

/** Renders the form once the link has been checked and the boxes are shown. */
async function renderForm() {
	mockUseSearchParams.mockReturnValue(new URLSearchParams("token=link-token"));
	const user = userEvent.setup();
	const { container } = renderWithoutProviders(<ResetPasswordForm />);
	await screen.findByRole("heading", { name: "Reset your password" });
	// Found by field name, so the behaviour checks do not depend on the labels.
	const named: Boxes = {
		first: inputNamed(container, "password"),
		second: inputNamed(container, "confirmPassword"),
	};
	return { user, container, named };
}

/** Found the way a person using a screen reader would find them. */
function boxesByLabel(): Boxes {
	return {
		first: screen.getByLabelText(NEW_PASSWORD_LABEL),
		second: screen.getByLabelText(CONFIRM_PASSWORD_LABEL),
	};
}

async function fill(
	user: User,
	boxes: Boxes,
	password: string,
	confirmation: string
) {
	await user.type(boxes.first, password);
	await user.type(boxes.second, confirmation);
}

function showButtons(): [HTMLElement, HTMLElement] {
	const [first, second] = screen.getAllByRole("button", {
		name: "Show password",
	});
	if (!(first && second)) {
		throw new Error("expected two show-password buttons");
	}
	return [first, second];
}

function submit(user: User) {
	return user.click(screen.getByRole("button", { name: "Reset password" }));
}

function stubFetchWith(status: number, body: unknown) {
	const fetchMock = vi.fn().mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		})
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("the reset page's password boxes", () => {
	beforeEach(() => {
		resetNavigationMocks();
	});

	it("are found by their labels and are two separate password inputs", async () => {
		await renderForm();

		const { first, second } = boxesByLabel();

		expect(first).not.toBe(second);
		expect(first).toBeInstanceOf(HTMLInputElement);
		expect(second).toBeInstanceOf(HTMLInputElement);
		expect(first).toHaveAttribute("type", "password");
		expect(second).toHaveAttribute("type", "password");
	});

	it("are named by their labels", async () => {
		await renderForm();

		const { first, second } = boxesByLabel();

		expect(first).toHaveAccessibleName(NEW_PASSWORD_LABEL);
		expect(second).toHaveAccessibleName(CONFIRM_PASSWORD_LABEL);
	});

	it("describe the first box by the strength rules", async () => {
		await renderForm();

		expect(boxesByLabel().first).toHaveAccessibleDescription(STRENGTH_RULES);
	});

	it("take focus when their label is clicked", async () => {
		const { user } = await renderForm();
		const { first, second } = boxesByLabel();

		await user.click(screen.getByText(CONFIRM_PASSWORD_LABEL));
		expect(second).toHaveFocus();

		await user.click(screen.getByText(NEW_PASSWORD_LABEL));
		expect(first).toHaveFocus();
	});

	it("are the only elements that carry the description and invalid markers", async () => {
		const { container, named } = await renderForm();

		const marked = container.querySelectorAll(
			"[aria-describedby], [aria-invalid]"
		);

		expect([...marked]).toEqual([named.first, named.second]);
	});

	it("mark the confirmation box invalid and describe it by the mismatch message", async () => {
		const { user, named } = await renderForm();
		await fill(user, named, STRONG_PASSWORD, "Different1!");

		await submit(user);

		const { first, second } = boxesByLabel();
		expect(await screen.findByText("Passwords do not match")).toBeVisible();
		expect(second).toHaveAttribute("aria-invalid", "true");
		expect(second).toHaveAccessibleDescription("Passwords do not match");
		expect(first).toHaveAttribute("aria-invalid", "false");
	});

	it("mark the first box invalid and keep the strength rules in its description", async () => {
		const { user, named } = await renderForm();
		await fill(user, named, "abc", "abc");

		await submit(user);

		const shortMessage = "Password must be at least 8 characters";
		expect(await screen.findByText(shortMessage)).toBeVisible();
		const { first } = boxesByLabel();
		expect(first).toHaveAttribute("aria-invalid", "true");
		expect(first).toHaveAccessibleDescription(
			expect.stringContaining(STRENGTH_RULES)
		);
		expect(first).toHaveAccessibleDescription(
			expect.stringContaining(shortMessage)
		);
	});
});

describe("the reset page's show-password buttons", () => {
	beforeEach(() => {
		resetNavigationMocks();
	});

	it.each([
		"first",
		"second",
	])("the %s one reveals and hides only its own box and keeps what was typed", async (which) => {
		const { user, named } = await renderForm();
		await fill(user, named, STRONG_PASSWORD, STRONG_PASSWORD);
		const isFirst = which === "first";
		const own = isFirst ? named.first : named.second;
		const other = isFirst ? named.second : named.first;
		const [showFirst, showSecond] = showButtons();
		const button = isFirst ? showFirst : showSecond;

		await user.click(button);

		expect(own).toHaveAttribute("type", "text");
		expect(own).toHaveValue(STRONG_PASSWORD);
		expect(other).toHaveAttribute("type", "password");
		expect(button).toHaveAccessibleName("Hide password");

		await user.click(button);

		expect(own).toHaveAttribute("type", "password");
		expect(button).toHaveAccessibleName("Show password");
	});

	it("sit between the boxes in the keyboard order", async () => {
		const { user, named } = await renderForm();
		const [showFirst, showSecond] = showButtons();
		const submitButton = screen.getByRole("button", { name: "Reset password" });

		named.first.focus();
		const visited: Element[] = [];
		for (let step = 0; step < 4; step++) {
			await user.tab();
			visited.push(document.activeElement as Element);
		}

		expect(visited).toEqual([
			showFirst,
			named.second,
			showSecond,
			submitButton,
		]);
	});
});

describe("submitting the reset page", () => {
	beforeEach(() => {
		resetNavigationMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("sends the link and the new password to the reset route", async () => {
		const fetchMock = stubFetchWith(200, { success: true });
		const { user, named } = await renderForm();
		await fill(user, named, STRONG_PASSWORD, STRONG_PASSWORD);

		await submit(user);

		expect(
			await screen.findByText("Password reset successful")
		).toBeInTheDocument();
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("/api/auth/reset-password");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(init?.body)).toEqual({
			token: "link-token",
			password: STRONG_PASSWORD,
		});
	});

	it("shows the route's refusal message and keeps the boxes when the link is refused with a 400", async () => {
		stubFetchWith(400, { error: REFUSAL, code: "VALIDATION" });
		const { user, named } = await renderForm();
		await fill(user, named, STRONG_PASSWORD, STRONG_PASSWORD);

		await submit(user);

		expect(await screen.findByText(REFUSAL)).toBeVisible();
		expect(named.first).toBeInTheDocument();
		expect(screen.queryByText(CONNECTION_ERROR)).not.toBeInTheDocument();
	});
});
