import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationTokenSummary } from "@/lib/schemas/integration";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { IntegrationTokenRow } from "../integration-token-row";

const ROTATE_REGEX = /rotate/i;
const ROTATING_REGEX = /rotating/i;
const REVOKE_REGEX = /revoke/i;

function makeToken(
	overrides: Partial<IntegrationTokenSummary> = {}
): IntegrationTokenSummary {
	return {
		id: "token-1",
		tokenPrefix: "tea_live_ab12",
		createdAt: "2026-06-01T00:00:00.000Z",
		lastUsedAt: null,
		expiresAt: null,
		revokedAt: null,
		...overrides,
	};
}

describe("IntegrationTokenRow", () => {
	it("renders a live token with a Live badge and rotate/revoke actions", () => {
		renderWithoutProviders(
			<IntegrationTokenRow
				canRotate
				onRevoke={vi.fn()}
				onRotate={vi.fn()}
				pending={false}
				token={makeToken()}
			/>
		);

		expect(screen.getByText("Live")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: ROTATE_REGEX })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: REVOKE_REGEX })
		).toBeInTheDocument();
	});

	it("renders a revoked token distinctly, with no rotate/revoke actions", () => {
		renderWithoutProviders(
			<IntegrationTokenRow
				canRotate
				onRevoke={vi.fn()}
				onRotate={vi.fn()}
				pending={false}
				token={makeToken({ revokedAt: "2026-06-15T00:00:00.000Z" })}
			/>
		);

		expect(screen.getByText("Revoked")).toBeInTheDocument();
		expect(screen.queryByText("Live")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: ROTATE_REGEX })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: REVOKE_REGEX })
		).not.toBeInTheDocument();
	});

	it("renders an expired-but-unrevoked token distinctly from both live and revoked", () => {
		renderWithoutProviders(
			<IntegrationTokenRow
				canRotate
				onRevoke={vi.fn()}
				onRotate={vi.fn()}
				pending={false}
				token={makeToken({ expiresAt: "2020-01-01T00:00:00.000Z" })}
			/>
		);

		expect(screen.getByText("Expired")).toBeInTheDocument();
		expect(screen.queryByText("Live")).not.toBeInTheDocument();
		expect(screen.queryByText("Revoked")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: ROTATE_REGEX })
		).not.toBeInTheDocument();
	});

	it("disables rotate (but not revoke) when the parent integration isn't ACTIVE", () => {
		renderWithoutProviders(
			<IntegrationTokenRow
				canRotate={false}
				onRevoke={vi.fn()}
				onRotate={vi.fn()}
				pending={false}
				token={makeToken()}
			/>
		);

		expect(screen.getByRole("button", { name: ROTATE_REGEX })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: REVOKE_REGEX })
		).not.toBeDisabled();
	});

	it("calls onRotate/onRevoke with the token id", async () => {
		const user = userEvent.setup();
		const onRotate = vi.fn();
		const onRevoke = vi.fn();
		renderWithoutProviders(
			<IntegrationTokenRow
				canRotate
				onRevoke={onRevoke}
				onRotate={onRotate}
				pending={false}
				token={makeToken({ id: "token-abc" })}
			/>
		);

		await user.click(screen.getByRole("button", { name: ROTATE_REGEX }));
		expect(onRotate).toHaveBeenCalledWith("token-abc");

		await user.click(screen.getByRole("button", { name: REVOKE_REGEX }));
		expect(onRevoke).toHaveBeenCalledWith("token-abc");
	});

	it("disables both actions and shows a pending label while a request for this token is in flight", () => {
		renderWithoutProviders(
			<IntegrationTokenRow
				canRotate
				onRevoke={vi.fn()}
				onRotate={vi.fn()}
				pending
				token={makeToken()}
			/>
		);

		expect(screen.getByRole("button", { name: ROTATING_REGEX })).toBeDisabled();
		expect(screen.getByRole("button", { name: REVOKE_REGEX })).toBeDisabled();
	});
});
