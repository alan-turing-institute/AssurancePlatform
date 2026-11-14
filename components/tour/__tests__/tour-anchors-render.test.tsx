import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActionButtons from "@/components/cases/action-buttons";
import CaseList from "@/components/cases/case-list";
import DesktopNav from "@/components/navigation/desktop-nav";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";

vi.mock("@/components/cases/case-settings-popover", () => ({
	CaseSettingsPopover: () => null,
}));

function anchors(): string[] {
	return [...document.querySelectorAll("[data-tour]")].map(
		(element) => element.getAttribute("data-tour") ?? ""
	);
}

describe("tour anchors in the rendered interface", () => {
	beforeEach(() => {
		// jsdom here has no working localStorage; CaseList reads its saved sort.
		vi.stubGlobal("localStorage", {
			getItem: () => null,
			setItem: () => undefined,
		});
		server.use(
			http.get("/api/user/plugins", () => HttpResponse.json({ plugins: [] })),
			http.get("/api/cases/:id/image", () =>
				HttpResponse.json({ error: "none" }, { status: 404 })
			)
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders the dashboard anchors and the tutorial card", () => {
		render(
			<CaseList
				assuranceCases={[
					{ id: 1, name: "Tutorial", isDemo: true, permissions: ["owner"] },
					{ id: 2, name: "Mine", permissions: ["owner"] },
				]}
				showCreate
			/>
		);

		expect(anchors()).toEqual(
			expect.arrayContaining([
				"case-filter",
				"case-sort",
				"import-case",
				"create-case",
				"tutorial-case",
			])
		);
		expect(anchors().filter((id) => id === "tutorial-case")).toHaveLength(1);
	});

	it("renders the sidebar anchors", () => {
		render(<DesktopNav teams={[]} />);

		expect(anchors()).toEqual(
			expect.arrayContaining([
				"sidebar-shared",
				"sidebar-teams",
				"sidebar-discover",
			])
		);
	});

	it("renders the toolbar anchors for a user who manages the case", () => {
		useStore.setState({
			assuranceCase: {
				id: "case-7",
				name: "Case",
				type: "assurance-case",
				permissions: "manage",
				createdDate: new Date().toISOString(),
				comments: [],
			},
		} as never);

		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);

		expect(anchors()).toEqual(
			expect.arrayContaining(["toolbar", "toolbar-share", "toolbar-help"])
		);
	});
});
