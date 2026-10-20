import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { captureLogs } from "../helpers/capture-logs";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("GET /api/health", () => {
	it("reports a healthy database with its latency", async () => {
		const { GET } = await import("@/app/api/health/route");
		const response = await GET();

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			status: "healthy",
			checks: {
				database: { status: "healthy", latencyMs: expect.any(Number) },
			},
		});
	});

	it("answers 503 with a fixed error text, never the thrown message, and logs only the error's class", async () => {
		const logs = captureLogs();
		vi.spyOn(prisma.user, "count").mockRejectedValue(
			new TypeError("connect ECONNREFUSED db.internal.example:5432")
		);

		let response: Response;
		try {
			const { GET } = await import("@/app/api/health/route");
			response = await GET();
		} finally {
			logs.restore();
		}
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toMatchObject({
			status: "unhealthy",
			checks: {
				database: {
					status: "unhealthy",
					error: "Database connection failed",
				},
			},
		});
		expect(JSON.stringify(body)).not.toContain("db.internal");
		expect(logs.entries).toHaveLength(1);
		expect(logs.entries[0]).toMatchObject({
			level: "error",
			errorName: "TypeError",
		});
		expect(JSON.stringify(logs.entries)).not.toContain("db.internal");
	});
});
