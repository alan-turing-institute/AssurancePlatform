import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fairRecruitmentStages } from "@/content/curriculum/tea-trainee/01-first-sip/stages";
import { firstSipTasks } from "@/content/curriculum/tea-trainee/01-first-sip/tasks";
import type { SelectedElementSummary } from "@/lib/docs/selected-element";
import type { Task } from "@/types/curriculum";
import {
	ModuleProgressProvider,
	useModuleProgress,
} from "../module-progress-context";
import ProgressiveCaseViewer from "../progressive-case-viewer";

vi.mock("../case-viewer-wrapper", () => ({
	default: ({
		onSelectedElementChange,
	}: {
		onSelectedElementChange?: (e: SelectedElementSummary | null) => void;
	}) => (
		<div>
			{["G1", "S1"].map((name) => (
				<button
					key={name}
					onClick={() =>
						onSelectedElementChange?.({
							id: `node-${name}`,
							name,
							type: name === "G1" ? "goal" : "strategy",
							isDefeater: false,
							attributes: {
								context: 0,
								assumption: false,
								justification: false,
							},
							parent: null,
							children: [],
						})
					}
					type="button"
				>
					{`pick ${name}`}
				</button>
			))}
		</div>
	),
}));

const STAGE_1 = /^Stage 1:/;
const STAGE_1_COMPLETED = /^Stage 1:.*\(completed\)/;
const G1_PROMPT_DONE = /Select the goal, G1\. \(done\)/;

const ResetButton = () => {
	const { resetProgress } = useModuleProgress();
	return (
		<button onClick={resetProgress} type="button">
			reset all
		</button>
	);
};

const renderViewer = () =>
	render(
		<ModuleProgressProvider
			courseId="tea-trainee"
			moduleId="first-sip"
			tasks={firstSipTasks as unknown as Task[]}
		>
			<ProgressiveCaseViewer stages={fairRecruitmentStages} />
			<ResetButton />
			<textarea aria-label="notes" />
		</ModuleProgressProvider>
	);

describe("ProgressiveCaseViewer", () => {
	it("ticks the prompt and completes the stage when the named element is selected", async () => {
		renderViewer();
		const stageDot = screen.getByRole("button", { name: STAGE_1 });
		expect(stageDot.getAttribute("aria-label")).not.toContain("(completed)");

		fireEvent.click(screen.getByRole("button", { name: "pick S1" }));
		expect(
			screen.getByRole("button", { name: STAGE_1 }).getAttribute("aria-label")
		).not.toContain("(completed)");
		expect(screen.queryByLabelText(G1_PROMPT_DONE)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "pick G1" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: STAGE_1_COMPLETED })
			).toBeInTheDocument();
		});
		expect(screen.getByLabelText(G1_PROMPT_DONE)).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Selected element" })
		).toHaveTextContent("Goal G1");
	});

	it("clears a stage's selections on reset and does not re-complete it", async () => {
		renderViewer();
		fireEvent.click(screen.getByRole("button", { name: "pick G1" }));
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: STAGE_1_COMPLETED })
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "reset all" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: STAGE_1 }).getAttribute("aria-label")
			).not.toContain("(completed)");
		});
		expect(screen.queryByLabelText(G1_PROMPT_DONE)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "pick S1" }));
		expect(
			screen.getByRole("button", { name: STAGE_1 }).getAttribute("aria-label")
		).not.toContain("(completed)");

		fireEvent.click(screen.getByRole("button", { name: "pick G1" }));
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: STAGE_1_COMPLETED })
			).toBeInTheDocument();
		});
	});

	it("leaves the stage alone when an arrow key is pressed inside a dialog", () => {
		renderViewer();
		const dialog = document.createElement("div");
		dialog.setAttribute("role", "dialog");
		const button = document.createElement("button");
		dialog.append(button);
		document.body.append(dialog);
		fireEvent.keyDown(button, { key: "ArrowRight" });
		dialog.remove();
		expect(screen.getByRole("button", { name: STAGE_1 })).toHaveAttribute(
			"aria-current",
			"step"
		);
	});

	it("leaves the stage alone when an arrow key is pressed inside a textarea", () => {
		renderViewer();
		fireEvent.keyDown(screen.getByLabelText("notes"), { key: "ArrowRight" });
		expect(screen.getByRole("button", { name: STAGE_1 })).toHaveAttribute(
			"aria-current",
			"step"
		);
	});
});
