import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { AiModelsPointer } from "../ai-models-pointer";

const POINTER_SENTENCE = /^This plugin uses the models set in/;

describe("AiModelsPointer", () => {
	it("is one line that sends the user to the AI models block", () => {
		renderWithoutProviders(<AiModelsPointer />);

		expect(screen.getByText(POINTER_SENTENCE)).toHaveTextContent(
			"This plugin uses the models set in AI models below."
		);
		expect(screen.getByRole("link", { name: "AI models" })).toHaveAttribute(
			"href",
			"#ai-models"
		);
	});
});
