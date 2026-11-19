import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CaseCard from "../case-card";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("CaseCard — the level icon", () => {
	it("shows the comment icon for someone who can comment", () => {
		const { container } = render(
			<CaseCard
				assuranceCase={{ id: 1, name: "Shared", permissions: "comment" }}
			/>
		);

		expect(
			container.querySelector(".lucide-message-circle-more")
		).not.toBeNull();
		expect(container.querySelector(".lucide-eye")).toBeNull();
	});
});
