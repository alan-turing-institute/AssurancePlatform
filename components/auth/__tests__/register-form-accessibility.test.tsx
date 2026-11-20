import { beforeEach, describe, expect, it } from "vitest";
import { resetNavigationMocks } from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import RegisterForm from "../register-form";

describe("the registration page's password boxes", () => {
	beforeEach(() => {
		resetNavigationMocks();
	});

	it("are found by their labels and are two separate password inputs", () => {
		renderWithoutProviders(<RegisterForm />);

		const first = screen.getByLabelText("Password", { exact: true });
		const second = screen.getByLabelText("Confirm Password");

		expect(first).not.toBe(second);
		expect(first).toBeInstanceOf(HTMLInputElement);
		expect(second).toBeInstanceOf(HTMLInputElement);
		expect(first).toHaveAttribute("type", "password");
		expect(second).toHaveAttribute("type", "password");
	});

	it("are named by their labels", () => {
		renderWithoutProviders(<RegisterForm />);

		expect(
			screen.getByLabelText("Password", { exact: true })
		).toHaveAccessibleName("Password");
		expect(screen.getByLabelText("Confirm Password")).toHaveAccessibleName(
			"Confirm Password"
		);
	});
});
