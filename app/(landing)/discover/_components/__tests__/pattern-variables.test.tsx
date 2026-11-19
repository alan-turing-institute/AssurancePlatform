import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PatternVariables from "../pattern-variables";

/**
 * The variables list on a published pattern's page: read from the public
 * snapshot alone, so it needs no session.
 */

const DEFAULT_VALUE = /Default value/;

function snapshotWith(...context: unknown[]) {
	return {
		version: "1.1",
		tree: { id: "g1", name: "G1", description: "Goal", children: [], context },
	};
}

describe("PatternVariables", () => {
	it("lists each variable with its meaning, and a value only where the pattern has one", () => {
		render(
			<PatternVariables
				content={snapshotWith(
					{
						id: "k3f9x2m7qa",
						name: "system",
						text: "The system this case is about",
						value: "AcmeBot",
						variable: true,
					},
					{
						id: "p4n8c2d6xz",
						name: "owner",
						text: "Who is responsible",
						variable: true,
					}
				)}
			/>
		);

		expect(screen.getByRole("heading", { name: "Variables" })).toBeVisible();
		expect(screen.getByText("system")).toBeVisible();
		expect(screen.getByText("The system this case is about")).toBeVisible();
		expect(screen.getByText("AcmeBot")).toBeVisible();
		expect(screen.getByText("owner")).toBeVisible();
		expect(screen.getByText("Who is responsible")).toBeVisible();
		expect(screen.getAllByText(DEFAULT_VALUE)).toHaveLength(1);
		const note = document.body.textContent ?? "";
		expect(note).toContain(
			"A case started from this pattern takes these values"
		);
		expect(note).not.toContain("asks you for a value");
	});

	it("shows markup in a name, meaning or value as text", () => {
		render(
			<PatternVariables
				content={snapshotWith({
					id: "k3f9x2m7qa",
					name: "system",
					text: "<img src=x onerror=alert(1)>",
					value: "<b>bold</b>",
					variable: true,
				})}
			/>
		);

		expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
		expect(screen.getByText("<b>bold</b>")).toBeVisible();
	});

	it("shows nothing for a pattern with no variables", () => {
		const { container } = render(
			<PatternVariables
				content={snapshotWith("A plain line", {
					id: "p4n8c2d6xz",
					name: "window",
					text: "An interval",
				})}
			/>
		);

		expect(container).toBeEmptyDOMElement();
	});
});
