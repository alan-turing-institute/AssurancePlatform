import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { signOut, useSession } from "next-auth/react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PasswordForm } from "../password-form";

/**
 * AP-QA-003: changing the password revokes every session for the account,
 * including the one that made the change — so a successful change must sign
 * the device out (delete-form.tsx's signOut precedent) rather than leave it
 * holding a now-revoked cookie until its next request.
 */
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
	signOut: vi.fn(),
}));

const CURRENT_PASSWORD_REGEX = /current password/i;
const NEW_PASSWORD_REGEX = /^new password$/i;
const CONFIRM_PASSWORD_REGEX = /confirm password/i;
const UPDATE_BUTTON_REGEX = /update/i;

describe("PasswordForm", () => {
	it("signs the device out after a successful password change", async () => {
		vi.mocked(useSession).mockReturnValue({
			data: {
				user: { id: "1" },
				provider: "credentials",
				expires: "2099-01-01T00:00:00.000Z",
			},
			status: "authenticated",
			update: vi.fn(),
		} as unknown as ReturnType<typeof useSession>);
		server.use(
			http.put("/api/users/me/password", () => HttpResponse.json({ data: true }))
		);

		const user = userEvent.setup();
		renderWithoutProviders(<PasswordForm data={{ id: "1" }} />);

		await user.type(
			screen.getByLabelText(CURRENT_PASSWORD_REGEX),
			"OldPassw0rd!"
		);
		await user.type(screen.getByLabelText(NEW_PASSWORD_REGEX), "NewPassw0rd!");
		await user.type(
			screen.getByLabelText(CONFIRM_PASSWORD_REGEX),
			"NewPassw0rd!"
		);
		await user.click(screen.getByRole("button", { name: UPDATE_BUTTON_REGEX }));

		await waitFor(() => {
			expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
		});
	});
});
