import { NextResponse } from "next/server";
import { errorClassName } from "@/lib/error-class-name";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = logger.child({ component: "health-route" });

/** What the public response says when the database check throws; the error's own message is never shown. */
const DATABASE_FAILED = "Database connection failed";

type HealthStatus = "healthy" | "unhealthy" | "degraded";

interface DatabaseCheck {
	error?: string;
	latencyMs?: number;
	status: HealthStatus;
}

interface HealthCheckResponse {
	checks: {
		database: DatabaseCheck;
	};
	status: HealthStatus;
	timestamp: string;
}

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
		dbError = DATABASE_FAILED;
		log.error("Health check could not reach the database", {
			errorName: errorClassName(error),
		});
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
