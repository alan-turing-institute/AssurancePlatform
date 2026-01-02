import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HealthStatus = "healthy" | "unhealthy" | "degraded";

type DatabaseCheck = {
	status: HealthStatus;
	latencyMs?: number;
	error?: string;
};

type HealthCheckResponse = {
	status: HealthStatus;
	timestamp: string;
	checks: {
		database: DatabaseCheck;
	};
};

/**
 * GET /api/health
 * Health check endpoint for Azure App Service health probes.
 * Returns 200 if healthy, 503 if unhealthy.
 *
 * This endpoint is public and requires no authentication.
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
	let dbStatus: HealthStatus = "healthy";
	let dbLatency: number | undefined;
	let dbError: string | undefined;

	try {
		const start = Date.now();
		await prisma.user.count({ take: 1 });
		dbLatency = Date.now() - start;

		// Mark as degraded if latency exceeds 1 second
		if (dbLatency > 1000) {
			dbStatus = "degraded";
		}
	} catch (error) {
		dbStatus = "unhealthy";
		dbError =
			error instanceof Error ? error.message : "Database connection failed";
	}

	const response: HealthCheckResponse = {
		status: dbStatus,
		timestamp: new Date().toISOString(),
		checks: {
			database: {
				status: dbStatus,
				...(dbLatency !== undefined && { latencyMs: dbLatency }),
				...(dbError && { error: dbError }),
			},
		},
	};

	return NextResponse.json(response, {
		status: dbStatus === "unhealthy" ? 503 : 200,
	});
}
