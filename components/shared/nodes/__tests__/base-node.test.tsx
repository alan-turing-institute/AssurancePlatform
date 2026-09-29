import { describe, expect, it } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import BaseNode from "../base-node";

/**
 * ADR 0005 D2: a defeater is a decoration on its existing card — a
 * "Defeater" chip and a distinct destructive-token border — applied
 * centrally in BaseNode so every node kind gets it for free.
 */
describe("BaseNode — defeater decoration (ADR 0005 D2)", () => {
	it("shows no Defeater chip and the node kind's own border by default", () => {
		const { container } = renderWithReactFlow(
			<BaseNode description="A claim" name="P1" nodeType="property" />
		);

		expect(screen.queryByText("Defeater")).not.toBeInTheDocument();
		const card = container.querySelector(".border-2");
		expect(card).not.toHaveClass("border-destructive/60");
	});

	it("shows the Defeater chip and a destructive-token border when isDefeater is true", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description="A counter-claim"
				isDefeater
				name="P2"
				nodeType="property"
			/>
		);

		expect(screen.getByText("Defeater")).toBeInTheDocument();
		const card = container.querySelector(".border-2");
		expect(card).toHaveClass("border-destructive/60");
	});

	it.each([
		"goal",
		"strategy",
		"property",
		"evidence",
	] as const)("applies the chip and border to the %s card kind too", (nodeType) => {
		renderWithReactFlow(
			<BaseNode
				description="Defeats something"
				isDefeater
				name="X1"
				nodeType={nodeType}
			/>
		);

		expect(screen.getByText("Defeater")).toBeInTheDocument();
	});
});
