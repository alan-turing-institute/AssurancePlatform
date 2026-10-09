import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LintCaseResult, type LintOutput } from "../lint-case-row";

const NO_FINDINGS = /no .*findings/i;

function row(ruleId: string, elementLabel: string, reason: string) {
	return { ruleId, elementLabel, reason };
}

function result(findings: LintOutput["findings"]): LintOutput {
	return { findings, acknowledgedGaps: [], prechecks: [], questions: [] };
}

describe("LintCaseResult", () => {
	it("lists prechecks under their own heading, apart from the findings", () => {
		render(
			<LintCaseResult
				result={{
					...result([row("TREE01", "case", "no single root")]),
					prechecks: [
						{
							ruleId: "SCOP01",
							elementLabel: "G1",
							detail: "context list is empty",
						},
					],
				}}
			/>
		);
		const root = screen.getByTestId("assistant-lint-result");
		const heading = within(root).getByRole("heading", { name: "Prechecks" });
		const items = within(
			heading.closest("section") as HTMLElement
		).getAllByRole("listitem");
		expect(items).toHaveLength(1);
		expect(items[0]?.textContent).toContain("SCOP01");
		expect(items[0]?.textContent).toContain("context list is empty");
	});

	it("shows no Prechecks heading when there are none", () => {
		render(<LintCaseResult result={result([])} />);
		expect(
			screen.queryByRole("heading", { name: "Prechecks" })
		).not.toBeInTheDocument();
	});

	it("groups findings by four-letter family code with rule id, element and reason on each line", () => {
		render(
			<LintCaseResult
				result={result([
					row("TREE03", "S2", "strategy has no children"),
					row("EVID01", "P1", "leaf claim is unsupported"),
					row("TREE01", "case", "no single root"),
				])}
			/>
		);
		const root = screen.getByTestId("assistant-lint-result");
		const headings = within(root).getAllByRole("heading");
		expect(headings.map((h) => h.textContent?.slice(0, 4)).sort()).toEqual([
			"EVID",
			"TREE",
		]);
		const tree = headings.find((h) => h.textContent?.startsWith("TREE"));
		const treeSection = tree?.closest("section") as HTMLElement;
		const lines = within(treeSection).getAllByRole("listitem");
		expect(lines).toHaveLength(2);
		const text = lines.map((l) => l.textContent).join("\n");
		for (const piece of [
			"TREE03",
			"S2",
			"strategy has no children",
			"TREE01",
			"case",
			"no single root",
		]) {
			expect(text).toContain(piece);
		}
		expect(text).not.toContain("EVID01");
		const evid = headings.find((h) => h.textContent?.startsWith("EVID"));
		const evidLines = within(
			evid?.closest("section") as HTMLElement
		).getAllByRole("listitem");
		expect(evidLines).toHaveLength(1);
		expect(evidLines[0]?.textContent).toContain("P1");
		expect(evidLines[0]?.textContent).toContain("leaf claim is unsupported");
	});

	it("renders every family code in the catalogue", () => {
		const codes = ["WORD", "PLAC", "STEP", "EVID", "SCOP", "TREE", "CONF"];
		render(
			<LintCaseResult
				result={result(codes.map((c) => row(`${c}01`, "G1", `reason ${c}`)))}
			/>
		);
		const headings = screen
			.getAllByRole("heading")
			.map((h) => h.textContent?.slice(0, 4));
		expect(headings.sort()).toEqual([...codes].sort());
	});

	it("shows a no-findings state for an empty result without crashing", () => {
		render(<LintCaseResult result={result([])} />);
		expect(screen.getByText(NO_FINDINGS)).toBeTruthy();
		expect(screen.queryAllByRole("listitem")).toHaveLength(0);
	});

	it("renders markup in a reason or label as text", () => {
		const { container } = render(
			<LintCaseResult
				result={result([
					row(
						"WORD01",
						"<b id='lbl'>G1</b>",
						"<img src=x onerror=alert(1)> <script>boom()</script>"
					),
				])}
			/>
		);
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("script")).toBeNull();
		expect(container.querySelector("#lbl")).toBeNull();
		expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
		expect(container.textContent).toContain("<b id='lbl'>G1</b>");
	});
});
