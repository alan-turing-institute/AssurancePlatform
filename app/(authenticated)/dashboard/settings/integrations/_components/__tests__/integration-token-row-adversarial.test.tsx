import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationTokenSummary } from "@/lib/schemas/integration";
import { IntegrationTokenRow } from "../integration-token-row";

const REASON = "Only an ACTIVE integration's tokens can be rotated";

function token(
	overrides: Partial<IntegrationTokenSummary> = {}
): IntegrationTokenSummary {
	return {
		id: "tok-1",
		tokenPrefix: "tea_abc",
		createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
		lastUsedAt: null,
		expiresAt: null,
		revokedAt: null,
		replacedByTokenId: null,
		...overrides,
	} as IntegrationTokenSummary;
}

function setup(
	props: { canRotate: boolean; pending?: boolean },
	t: IntegrationTokenSummary = token()
) {
	const onRotate = vi.fn();
	const onRevoke = vi.fn();
	render(
		<IntegrationTokenRow
			canRotate={props.canRotate}
			onRevoke={onRevoke}
			onRotate={onRotate}
			pending={props.pending ?? false}
			token={t}
		/>
	);
	return { onRevoke, onRotate, user: userEvent.setup() };
}

function rotate() {
	return screen.getByRole("button", { name: /rotat/i });
}

describe("Rotate on a token of an integration that cannot rotate", () => {
	it("can be reached with Tab and says why it is inert", async () => {
		const { user } = setup({ canRotate: false });
		await user.tab();
		expect(rotate()).toHaveFocus();
		expect(rotate()).toHaveAttribute("aria-disabled", "true");
		expect(rotate()).not.toHaveAttribute("disabled");
		expect(rotate()).toHaveAccessibleDescription(REASON);
	});

	it("does nothing on click, Enter or Space", async () => {
		const { onRotate, user } = setup({ canRotate: false });
		rotate().focus();
		await user.click(rotate());
		await user.keyboard("{Enter}");
		await user.keyboard(" ");
		expect(onRotate).not.toHaveBeenCalled();
	});

	it("has no title attribute carrying the reason", () => {
		setup({ canRotate: false });
		expect(rotate()).not.toHaveAttribute("title");
	});

	it("still lets the token be revoked", async () => {
		const { onRevoke, user } = setup({ canRotate: false });
		await user.click(screen.getByRole("button", { name: "Revoke this token" }));
		expect(onRevoke).toHaveBeenCalledExactlyOnceWith("tok-1");
	});
});

describe("Rotate while a rotation is pending", () => {
	it("is inert, labelled Rotating and sends nothing", async () => {
		const { onRotate, user } = setup({ canRotate: true, pending: true });
		expect(rotate()).toHaveTextContent("Rotating…");
		expect(rotate()).toHaveAttribute("aria-disabled", "true");
		await user.click(rotate());
		rotate().focus();
		await user.keyboard("{Enter}");
		expect(onRotate).not.toHaveBeenCalled();
	});

	it("carries no reason when the integration is active", () => {
		setup({ canRotate: true, pending: true });
		expect(rotate()).not.toHaveAccessibleDescription(REASON);
		expect(screen.queryByText(REASON)).toBeNull();
	});

	it("keeps the reason when it is both pending and not rotatable", () => {
		setup({ canRotate: false, pending: true });
		expect(rotate()).toHaveAccessibleDescription(REASON);
	});
});

describe("Rotate on an active integration", () => {
	it("is enabled, has no description, and fires once per click", async () => {
		const { onRotate, user } = setup({ canRotate: true });
		expect(rotate()).not.toHaveAttribute("aria-disabled");
		expect(rotate()).toHaveAccessibleDescription("");
		await user.click(rotate());
		expect(onRotate).toHaveBeenCalledExactlyOnceWith("tok-1");
	});

	it("is absent once the token has been replaced", () => {
		setup({ canRotate: true }, token({ replacedByTokenId: "tok-2" }));
		expect(screen.queryByRole("button", { name: /rotat/i })).toBeNull();
	});

	it("is absent from a revoked token", () => {
		setup(
			{ canRotate: false },
			token({ revokedAt: new Date("2026-02-01T00:00:00Z").toISOString() })
		);
		expect(screen.queryByRole("button", { name: /rotat/i })).toBeNull();
		expect(screen.queryByText(REASON)).toBeNull();
	});
});
