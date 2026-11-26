import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLiveEvidenceNodes } from "../use-live-evidence-nodes";

function Probe() {
	const nodes = useLiveEvidenceNodes("case-1", false);
	return <span>{`loaded=${nodes.loaded} nodes=${nodes.byNodeId.size}`}</span>;
}

describe("the live evidence nodes while a page is hydrated", () => {
	it("are an empty, not yet loaded list", () => {
		const container = document.createElement("div");
		container.innerHTML = "<span>loaded=false nodes=0</span>";
		document.body.append(container);

		const problems: unknown[] = [];

		const { container: hydrated } = render(<Probe />, {
			container,
			hydrate: true,
			onRecoverableError: (error) => problems.push(error),
		});

		expect(problems).toStrictEqual([]);
		expect(hydrated.textContent).toBe("loaded=false nodes=0");
		container.remove();
	});
});
