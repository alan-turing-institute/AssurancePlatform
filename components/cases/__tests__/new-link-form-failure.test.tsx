import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithReactFlow,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import NewLinkForm from "../new-link-form";

const GOAL: Node = {
	id: "goal-1",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: "33333333-3333-4333-8333-333333333333", name: "G1" },
};

function resetStore(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			goals: [{ id: GOAL.data.id, name: "G1", propertyClaims: [] }],
		} as never,
	});
}

function renderForm(linkType: string) {
	const actions = {
		setSelectedLink: vi.fn(),
		setLinkToCreate: vi.fn(),
		handleClose: vi.fn(),
	};
	renderWithReactFlow(
		<NewLinkForm
			actions={actions}
			linkType={linkType}
			node={GOAL}
			setUnresolvedChanges={vi.fn()}
		/>
	);
	return actions;
}

beforeEach(() => {
	resetStore();
});

describe("NewLinkForm — the Add button when creation fails", () => {
	it.each([
		"claim",
		"strategy",
		"defeater",
		"evidence",
	])("is pressable again after a failed %s, and the dialog stays open", async (linkType) => {
		let calls = 0;
		server.use(
			http.post("/api/cases/:caseId/elements", () => {
				calls += 1;
				return calls === 1
					? HttpResponse.json({ error: "Could not save" }, { status: 500 })
					: HttpResponse.json(
							{ id: "created-1", name: "X1", propertyClaimId: ["none"] },
							{ status: 201 }
						);
			})
		);
		const actions = renderForm(linkType);
		const user = userEvent.setup();
		const add = screen.getByRole("button", { name: "Add" });

		await user.type(screen.getByLabelText("Description"), "Something to add");
		await user.click(add);

		await waitFor(() => expect(calls).toBe(1));
		await waitFor(() => expect(add).toBeEnabled());
		expect(actions.handleClose).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Description")).toHaveValue(
			"Something to add"
		);

		await user.click(add);
		await waitFor(() => expect(calls).toBe(2));
	});

	it("is disabled while the request is out", async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		server.use(
			http.post("/api/cases/:caseId/elements", async () => {
				await gate;
				return HttpResponse.json({ error: "Could not save" }, { status: 500 });
			})
		);
		renderForm("claim");
		const user = userEvent.setup();
		const add = screen.getByRole("button", { name: "Add" });

		await user.type(screen.getByLabelText("Description"), "Slow claim");
		await user.click(add);

		await waitFor(() => expect(add).toBeDisabled());
		release();
		await waitFor(() => expect(add).toBeEnabled());
	});

	it("is pressable again after a claim fails because the connection drops", async () => {
		server.use(
			http.post("/api/cases/:caseId/elements", () => HttpResponse.error())
		);
		renderForm("claim");
		const user = userEvent.setup();
		const add = screen.getByRole("button", { name: "Add" });

		await user.type(screen.getByLabelText("Description"), "Offline claim");
		await user.click(add);

		await waitFor(() => expect(add).toBeEnabled());
	});
});
