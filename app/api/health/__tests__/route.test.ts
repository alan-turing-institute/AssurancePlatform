import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma before importing the route
vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			count: vi.fn(),
		},
	},
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../route";

describe("/api/health", () => {
	const mockPrisma = vi.mocked(prisma);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("calls prisma.user.count with take: 1 to verify DB connectivity", async () => {
		mockPrisma.user.count.mockResolvedValue(0);

		await GET();

		expect(mockPrisma.user.count).toHaveBeenCalledWith({ take: 1 });
		expect(mockPrisma.user.count).toHaveBeenCalledTimes(1);
	});

	it("returns 200 with healthy status when database responds", async () => {
		mockPrisma.user.count.mockResolvedValue(0);

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe("healthy");
		expect(data.checks.database.status).toBe("healthy");
		expect(typeof data.checks.database.latencyMs).toBe("number");
	});

	it("returns 503 with unhealthy status when database fails", async () => {
		mockPrisma.user.count.mockRejectedValue(new Error("Connection refused"));

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data.status).toBe("unhealthy");
		expect(data.checks.database.error).toBe("Connection refused");
	});

	it("returns degraded status when latency exceeds 1 second", async () => {
		mockPrisma.user.count.mockImplementation(async () => {
			await new Promise((resolve) => setTimeout(resolve, 1100));
			return 0;
		});

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe("degraded");
		expect(data.checks.database.latencyMs).toBeGreaterThan(1000);
	});

	it("handles non-Error exceptions gracefully", async () => {
		mockPrisma.user.count.mockRejectedValue("string error");

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data.checks.database.error).toBe("Database connection failed");
	});
});
