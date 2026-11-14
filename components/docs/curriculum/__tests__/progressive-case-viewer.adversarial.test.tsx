import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectedElementSummary } from "@/lib/docs/selected-element";
import ProgressiveCaseViewer from "../progressive-case-viewer";
import type { StageDefinition } from "../stage-definitions";

const completeTask = vi.fn();
let onChange: (element: SelectedElementSummary | null) => void = () => {
	// replaced by the stub on render
};

vi.mock("../module-progress-context", async () => {
	const { useCallback, useState } = await import("react");
	return {
		useModuleProgress: () => {
			const [done, setDone] = useState<string[]>([]);
			const getTask = useCallback(
				(id: string) => ({ id, completed: done.includes(id) }),
				[done]
			);
			return {
				getTask,
				completeTask: (id: string) => {
					completeTask(id);
					setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
				},
			};
		},
	};
});

vi.mock("../case-viewer-wrapper", () => ({
	default: (props: {
		caseFile: string;
		onSelectedElementChange: (e: SelectedElementSummary | null) => void;
	}) => {
		onChange = props.onSelectedElementChange;
		return <div data-testid="viewer">{props.caseFile}</div>;
	},
}));

const stage = (
	id: number,
	prompts?: StageDefinition["prompts"]
): StageDefinition => ({
	id,
	title: `Title ${id}`,
	shortTitle: `T${id}`,
	guidance: `Guidance ${id}`,
	caseFile: `case-${id}.json`,
	taskId: `task-${id}`,
	prompts,
});

const STAGES: StageDefinition[] = [
	stage(1, [{ id: "g", text: "Pick the goal", select: ["G1"] }]),
	stage(2),
	stage(3, [{ id: "g", text: "Pick the goal again", select: ["G1"] }]),
	stage(4, [{ id: "p", text: "Pick the claims", select: ["P1", "P2"] }]),
];

const pick = (name: string) =>
	act(() =>
		onChange({
			id: name.toLowerCase(),
			name,
			type: "property",
			isDefeater: false,
			attributes: { context: 0, assumption: false, justification: false },
			parent: null,
			children: [],
		})
	);

const press = (target: Element | Window, key = "ArrowRight") =>
	fireEvent.keyDown(target, { key });

const tickCount = (container: HTMLElement) =>
	container.querySelectorAll('li[aria-label$="(done)"]').length;

const stageHeading = () => screen.getByRole("heading", { level: 3 });

beforeEach(() => {
	completeTask.mockClear();
});

describe("ProgressiveCaseViewer prompts (adversarial)", () => {
	it("does not complete a stage until every prompt element is selected, then completes once", () => {
		const { container } = render(
			<ProgressiveCaseViewer initialStage={4} stages={STAGES} />
		);
		pick("P1");
		expect(completeTask).not.toHaveBeenCalled();
		expect(tickCount(container)).toBe(0);

		pick("P2");
		expect(completeTask).toHaveBeenCalledTimes(1);
		expect(completeTask).toHaveBeenCalledWith("task-4");
		expect(tickCount(container)).toBe(1);

		pick("P1");
		pick("P2");
		expect(completeTask).toHaveBeenCalledTimes(1);
	});

	it("does not count a selection made on stage 1 towards stage 3", () => {
		const { container } = render(
			<ProgressiveCaseViewer initialStage={1} stages={STAGES} />
		);
		pick("G1");
		expect(completeTask).toHaveBeenCalledWith("task-1");

		press(document.body);
		press(document.body);
		expect(stageHeading()).toHaveTextContent("Stage 3");
		expect(tickCount(container)).toBe(0);
		expect(completeTask).not.toHaveBeenCalledWith("task-3");
	});

	it("shows an earlier stage's prompts ticked after advancing and coming back", () => {
		const { container } = render(
			<ProgressiveCaseViewer initialStage={1} stages={STAGES} />
		);
		pick("G1");
		press(document.body);
		expect(stageHeading()).toHaveTextContent("Stage 2");
		press(document.body, "ArrowLeft");
		expect(stageHeading()).toHaveTextContent("Stage 1");
		expect(tickCount(container)).toBe(1);
	});

	it("completes a stage without prompts on arrow-advance", () => {
		render(<ProgressiveCaseViewer initialStage={2} stages={STAGES} />);
		press(document.body);
		expect(completeTask).toHaveBeenCalledWith("task-2");
		expect(stageHeading()).toHaveTextContent("Stage 3");
	});
});

describe("stage stepper keyboard capture (adversarial)", () => {
	const mount = () => {
		const field = {
			textarea: document.createElement("textarea"),
			input: document.createElement("input"),
			flowInner: document.createElement("span"),
		};
		const flow = document.createElement("div");
		flow.className = "react-flow";
		flow.append(field.flowInner);
		document.body.append(field.textarea, field.input, flow);
		return {
			...field,
			cleanup: () => {
				field.textarea.remove();
				field.input.remove();
				flow.remove();
			},
		};
	};

	it.each([
		"textarea",
		"input",
		"flowInner",
	] as const)("ignores ArrowRight from a %s but not from the body", (which) => {
		const m = mount();
		render(<ProgressiveCaseViewer initialStage={1} stages={STAGES} />);
		press(m[which]);
		expect(stageHeading()).toHaveTextContent("Stage 1");
		expect(completeTask).not.toHaveBeenCalled();

		press(document.body);
		expect(stageHeading()).toHaveTextContent("Stage 2");
		m.cleanup();
	});
});
