import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { IntegrationsSection } from "../integrations-section";

const REGISTER_BUTTON_REGEX = /register integration/i;
const NAME_LABEL_REGEX = /^name$/i;
const READ_CASES_CHECKBOX_REGEX = /read cases/i;
const CANCEL_BUTTON_REGEX = /cancel/i;
const FAILED_CASE_GRANTS_TEXT_REGEX = /failed to list case grants/i;

const INTEGRATION = {
	id: "integration-1",
	name: "darter-evidence-pipeline",
	description: "Evidence collection pipeline",
	scopes: ["case:read"],
	status: "ACTIVE",
	createdAt: "2026-06-01T00:00:00.000Z",
	updatedAt: "2026-06-01T00:00:00.000Z",
	lastSeenAt: null,
	tokens: [],
};

afterEach(() => {
	vi.restoreAllMocks();
});

// Every rendered `IntegrationCard` fires its own `GET .../case-grants` (see
// `useIntegrationCaseGrants`) — none of the tests below exercise case
// access, so this default keeps them green without each one needing its
// own handler for a resource they don't care about.
beforeEach(() => {
	server.use(
		http.get("/api/integrations/:id/case-grants", () =>
			HttpResponse.json({ grants: [] })
		)
	);
});

describe("IntegrationsSection", () => {
	it("shows a loading state before the list resolves, then renders the integration", async () => {
		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json({ integrations: [INTEGRATION] })
			)
		);

		renderWithoutProviders(<IntegrationsSection />);

		expect(
			screen.getByTestId("integrations-section-loading")
		).toBeInTheDocument();

		await waitFor(() =>
			expect(screen.getByText("darter-evidence-pipeline")).toBeInTheDocument()
		);
		expect(
			screen.queryByTestId("integrations-section-loading")
		).not.toBeInTheDocument();
	});

	it("shows an error message when the GET route fails", async () => {
		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json(
					{ error: "Failed to list integrations" },
					{ status: 500 }
				)
			)
		);

		renderWithoutProviders(<IntegrationsSection />);

		await waitFor(() =>
			expect(
				screen.getByText("Failed to list integrations")
			).toBeInTheDocument()
		);
	});

	it("shows an empty message when the caller has no integrations registered", async () => {
		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json({ integrations: [] })
			)
		);

		renderWithoutProviders(<IntegrationsSection />);

		await waitFor(() =>
			expect(
				screen.getByText("You haven't registered any integrations yet.")
			).toBeInTheDocument()
		);
	});

	it("opens the register dialog from the header button and registers through the full round trip", async () => {
		let integrations: (typeof INTEGRATION)[] = [];
		server.use(
			http.get("/api/integrations", () => HttpResponse.json({ integrations })),
			http.post("/api/integrations", async ({ request }) => {
				const body = (await request.json()) as {
					name: string;
					scopes: string[];
				};
				integrations = [
					{ ...INTEGRATION, name: body.name, scopes: body.scopes },
				];
				return HttpResponse.json(
					{ integration: integrations[0] },
					{ status: 201 }
				);
			})
		);

		const user = userEvent.setup();
		renderWithoutProviders(<IntegrationsSection />);

		await waitFor(() =>
			expect(
				screen.getByText("You haven't registered any integrations yet.")
			).toBeInTheDocument()
		);

		await user.click(
			screen.getByRole("button", { name: REGISTER_BUTTON_REGEX })
		);
		const dialog = await screen.findByRole("dialog");
		await user.type(screen.getByLabelText(NAME_LABEL_REGEX), "new-pipeline");
		await user.click(
			screen.getByRole("checkbox", { name: READ_CASES_CHECKBOX_REGEX })
		);
		await user.click(
			within(dialog).getByRole("button", { name: REGISTER_BUTTON_REGEX })
		);

		await waitFor(() =>
			expect(screen.getByText("new-pipeline")).toBeInTheDocument()
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
	});

	it("does not leak stale form field values into a freshly reopened register dialog (pins the react-doctor remount fix, f324045e)", async () => {
		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json({ integrations: [] })
			)
		);

		const user = userEvent.setup();
		renderWithoutProviders(<IntegrationsSection />);

		await waitFor(() =>
			expect(
				screen.getByText("You haven't registered any integrations yet.")
			).toBeInTheDocument()
		);

		await user.click(
			screen.getByRole("button", { name: REGISTER_BUTTON_REGEX })
		);
		let dialog = await screen.findByRole("dialog");
		await user.type(
			within(dialog).getByLabelText(NAME_LABEL_REGEX),
			"stale-value"
		);
		await user.click(
			within(dialog).getByRole("checkbox", { name: READ_CASES_CHECKBOX_REGEX })
		);
		await user.click(
			within(dialog).getByRole("button", { name: CANCEL_BUTTON_REGEX })
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		// Reopening is the exact click that bumps `registerDialogInstance` and
		// remounts `IntegrationRegisterDialog` under a fresh `key`. Before
		// f324045e this form state lived in a `useForm` instance kept alive
		// across opens and reset imperatively from a `useEffect` watching
		// `open` — a regression back to that pattern, or dropping the `key`
		// bump on the register button's click handler, would leave
		// "stale-value" and the checked checkbox showing here.
		await user.click(
			screen.getByRole("button", { name: REGISTER_BUTTON_REGEX })
		);
		dialog = await screen.findByRole("dialog");

		expect(within(dialog).getByLabelText(NAME_LABEL_REGEX)).toHaveValue("");
		expect(
			within(dialog).getByRole("checkbox", { name: READ_CASES_CHECKBOX_REGEX })
		).not.toBeChecked();
	});

	it("isolates a case-access load failure to the one card whose GET 500s — the sibling card renders fine, with exactly one case-grants GET per card (nanaki G3 fault-isolation probe)", async () => {
		const failingIntegration = {
			...INTEGRATION,
			id: "integration-fails",
			name: "flaky-pipeline",
		};
		const healthyIntegration = {
			...INTEGRATION,
			id: "integration-ok",
			name: "steady-pipeline",
		};
		const callsById: Record<string, number> = {};

		server.use(
			http.get("/api/integrations", () =>
				HttpResponse.json({
					integrations: [failingIntegration, healthyIntegration],
				})
			),
			http.get("/api/integrations/:id/case-grants", ({ params }) => {
				const id = params.id as string;
				callsById[id] = (callsById[id] ?? 0) + 1;
				if (id === failingIntegration.id) {
					return HttpResponse.json(
						{ error: "Failed to list case grants" },
						{ status: 500 }
					);
				}
				return HttpResponse.json({
					grants: [
						{
							caseId: "case-1",
							caseName: "Assurance",
							permission: "EDIT",
							grantedAt: "2026-07-10T00:00:00.000Z",
						},
					],
				});
			})
		);

		renderWithoutProviders(<IntegrationsSection />);

		await waitFor(() =>
			expect(screen.getByText("flaky-pipeline")).toBeInTheDocument()
		);
		expect(screen.getByText("steady-pipeline")).toBeInTheDocument();

		const failingCard = screen.getByTestId(
			`integration-card-${failingIntegration.id}`
		);
		const healthyCard = screen.getByTestId(
			`integration-card-${healthyIntegration.id}`
		);

		await waitFor(() =>
			expect(
				within(failingCard).getByText("Failed to list case grants")
			).toBeInTheDocument()
		);
		// The sibling card's own GET succeeded independently — one card's
		// 500 never poisons the other's case-access state.
		expect(
			within(healthyCard).getByTestId("case-access-row-case-1")
		).toBeInTheDocument();
		expect(
			within(healthyCard).queryByText(FAILED_CASE_GRANTS_TEXT_REGEX)
		).not.toBeInTheDocument();

		await waitFor(() => expect(callsById[failingIntegration.id]).toBe(1));
		expect(callsById[healthyIntegration.id]).toBe(1);
		expect(Object.keys(callsById)).toHaveLength(2);
	});
});
