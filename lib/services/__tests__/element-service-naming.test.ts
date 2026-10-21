import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { regenerateNameForIsDefeaterChange } from "../element-service";

vi.mock("@/lib/prisma", () => ({
	prisma: {
		assuranceElement: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
		},
	},
}));

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(prisma.assuranceElement.count).mockResolvedValue(0);
	vi.mocked(prisma.assuranceElement.findMany).mockResolvedValue([]);
});

function parent(name: string, isDefeater = false) {
	return { name, elementType: "PROPERTY_CLAIM", isDefeater, level: 1 };
}

describe("property claim auto-naming", () => {
	it.each([
		["Property claim", "P1"],
		["PNaN", "P1"],
		["P1", "P1.1"],
	])("plain claim under %s gets %s", async (name, expected) => {
		vi.mocked(prisma.assuranceElement.findFirst).mockResolvedValue(
			parent(name) as never
		);

		expect(
			await regenerateNameForIsDefeaterChange(
				"PROPERTY_CLAIM",
				"case",
				"parent",
				false
			)
		).toBe(expected);
	});

	it.each([
		["Property claim", "CP1"],
		["PNaN", "CP1"],
		["CPNaN", "CP1"],
		["CP1", "CP1.1"],
	])("defeater claim under defeater %s gets %s", async (name, expected) => {
		vi.mocked(prisma.assuranceElement.findFirst).mockResolvedValue(
			parent(name, true) as never
		);

		expect(
			await regenerateNameForIsDefeaterChange(
				"PROPERTY_CLAIM",
				"case",
				"parent",
				true
			)
		).toBe(expected);
	});

	it.each([
		["Property claim", "P1"],
		["PNaN", "P1"],
		["P1", "P1.1"],
	])("plain claim under a strategy below %s gets %s", async (name, expected) => {
		vi.mocked(prisma.assuranceElement.findFirst)
			.mockResolvedValueOnce({
				elementType: "STRATEGY",
				parentId: "ancestor",
				name: "S1",
			} as never)
			.mockResolvedValueOnce(parent(name) as never)
			.mockResolvedValueOnce({ parentId: "ancestor" } as never)
			.mockResolvedValueOnce(parent(name) as never);

		expect(
			await regenerateNameForIsDefeaterChange(
				"PROPERTY_CLAIM",
				"case",
				"strategy",
				false
			)
		).toBe(expected);
	});
});
