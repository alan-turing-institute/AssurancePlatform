import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import BaseNode from "../base-node";

const CARD_COUNT = 20;
const CARD_IDS = Array.from({ length: CARD_COUNT }, (_, i) => i);
const EXPAND_BUTTON = /expand node/i;
const SETTLE_MS = 1500;

const settle = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
	});

describe("BaseNode — layout on open", () => {
	const layoutNodes = vi.fn(() => Promise.resolve());
	const original = useStore.getState().layoutNodes;

	beforeEach(() => {
		layoutNodes.mockClear();
		useStore.setState({ layoutNodes });
	});

	afterEach(() => {
		useStore.setState({ layoutNodes: original });
	});

	it("lays out once when many cards finish their fade-in", async () => {
		renderWithReactFlow(
			<div>
				{CARD_IDS.map((id) => (
					<BaseNode
						description={`Claim ${id}`}
						key={id}
						name={`P${id}`}
						nodeType="property"
					/>
				))}
			</div>
		);
		await settle();

		expect(layoutNodes).toHaveBeenCalledTimes(1);
	});

	it("lays out once after a card is expanded", async () => {
		renderWithReactFlow(
			<BaseNode description="Claim" name="P1" nodeType="property" />
		);
		await settle();
		layoutNodes.mockClear();

		fireEvent.click(screen.getByRole("button", { name: EXPAND_BUTTON }));
		await settle();

		expect(layoutNodes).toHaveBeenCalledTimes(1);
	});
});
