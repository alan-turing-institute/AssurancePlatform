import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CaseList from "@/components/cases/case-list";
import { server } from "@/src/__tests__/mocks/server";
import { TrashList } from "../trash-list";

beforeEach(() => {
	// jsdom here has no working localStorage; CaseList reads its saved sort.
	vi.stubGlobal("localStorage", {
		getItem: () => null,
		setItem: () => undefined,
	});
	server.use(
		http.get("/api/cases/:id/image", () =>
			HttpResponse.json({ error: "none" }, { status: 404 })
		)
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the Pattern badge in case lists", () => {
	it("marks a pattern and leaves an ordinary case unmarked", () => {
		render(
			<CaseList
				assuranceCases={[
					{
						id: "p1",
						name: "A pattern",
						kind: "PATTERN",
						permissions: "owner",
					},
					{ id: "c1", name: "A case", kind: "CASE", permissions: "owner" },
					{ id: "c2", name: "Kindless case", permissions: "owner" },
				]}
			/>
		);

		expect(screen.getAllByText("Pattern")).toHaveLength(1);
		const patternCard = screen.getByText("A pattern").closest("a");
		expect(patternCard).toHaveTextContent("Pattern");
		expect(screen.getByText("A case").closest("a")).not.toHaveTextContent(
			"Pattern"
		);
	});
});

describe("the Pattern badge in the trash", () => {
	it("marks a trashed pattern and leaves a trashed case unmarked", () => {
		const base = {
			createdAt: new Date().toISOString(),
			daysRemaining: 20,
			deletedAt: new Date().toISOString(),
			description: null,
		};
		render(
			<TrashList
				cases={[
					{ ...base, id: "p1", name: "Old pattern", kind: "PATTERN" },
					{ ...base, id: "c1", name: "Old case", kind: "CASE" },
				]}
			/>
		);

		expect(screen.getAllByText("Pattern")).toHaveLength(1);
		expect(screen.getByText("Old pattern").closest("td")).toHaveTextContent(
			"Pattern"
		);
		expect(screen.getByText("Old case").closest("td")).not.toHaveTextContent(
			"Pattern"
		);
	});
});
