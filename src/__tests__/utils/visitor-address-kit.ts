import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { vi } from "vitest";
import { GET as whoamiGET } from "@/app/api/machine/whoami/route";
import { TOKEN_PREFIX } from "@/lib/auth/api-token-service";
import prisma from "@/lib/prisma";
import { RATE_LIMIT_CONFIGS } from "@/lib/services/rate-limit-service";
import { mockAuth } from "./auth-helpers";
import { createTestUser } from "./prisma-factories";

/**
 * The callers of `extractClientIp` that this repository exercises through
 * their routes, each with a way to send a request carrying given headers and
 * a way to read back the addresses its own bookkeeping stored.
 *
 * A test file that uses this kit must mock `next/headers` (its `headers`
 * export) and `@/lib/auth/validate-session` (its `validateSession` export),
 * as `cloudflare-visitor-address.test.ts` does.
 */

export const SETTING = "CLOUDFLARE_ORIGIN_SECRET";
export const SECRET = "origin-secret-for-the-visitor-address-tests-Zq9";
export const CLOUDFLARE = "173.245.48.5";
export const CLOUDFLARE_V6 = "2606:4700::6810:84e5";
export const DIRECT = "203.0.113.5";
export const VISITOR = "198.51.100.10";
export const OTHER_VISITOR = "198.51.100.11";

const PASSWORD = "A-strong-Password-1!";

export type HeaderInit = Record<string, string>;

export interface Caller {
	name: string;
	/** The addresses the caller has stored, without repeats, sorted. */
	recorded: () => Promise<string[]>;
	send: (init: HeaderInit) => Promise<Response>;
}

/** A caller together with the number of attempts one address gets per window. */
export interface LimitedCaller {
	attempts: number;
	caller: Caller;
}

/**
 * Headers of a request that Turing's Cloudflare zone passed on for `visitor`.
 * An override of `undefined` leaves that header out.
 */
export function viaCloudflare(
	visitor: string,
	overrides: Record<string, string | undefined> = {}
): HeaderInit {
	const fields = {
		"x-client-ip": CLOUDFLARE,
		"cf-connecting-ip": visitor,
		"x-origin-verify": SECRET,
		...overrides,
	};
	const present = Object.entries(fields).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return Object.fromEntries(present);
}

let counter = 0;

function nextNumber(): number {
	counter += 1;
	return counter;
}

function postJson(path: string, body: unknown): Request {
	return new Request(`http://localhost:3000${path}`, {
		method: "POST",
		body: JSON.stringify(body),
	});
}

function present(init: HeaderInit): void {
	vi.mocked(headers).mockResolvedValue(
		new Headers(init) as Awaited<ReturnType<typeof headers>>
	);
}

function distinctSorted(values: (string | null)[]): string[] {
	const present = values.filter((value): value is string => value !== null);
	return [...new Set(present)].sort();
}

async function attemptAddresses(endpoint: string): Promise<string[]> {
	const rows = await prisma.rateLimitAttempt.findMany({
		where: { endpoint, identifierType: "ip" },
	});
	return distinctSorted(rows.map((row) => row.identifier));
}

async function auditAddresses(eventType: string): Promise<string[]> {
	const rows = await prisma.securityAuditLog.findMany({ where: { eventType } });
	return distinctSorted(rows.map((row) => row.ipAddress));
}

const registration: Caller = {
	name: "registration",
	async send(init) {
		present(init);
		const n = nextNumber();
		const { POST } = await import("@/app/api/users/register/route");
		return await POST(
			postJson("/api/users/register", {
				username: `visitor-${n}`,
				email: `visitor-${n}@example.com`,
				password: PASSWORD,
			})
		);
	},
	recorded: () => attemptAddresses("register"),
};

const passwordResetRequest: Caller = {
	name: "password reset request",
	async send(init) {
		present(init);
		const { POST } = await import("@/app/api/auth/forgot-password/route");
		return await POST(
			postJson("/api/auth/forgot-password", {
				email: `nobody-${nextNumber()}@example.com`,
			})
		);
	},
	async recorded() {
		const rows = await prisma.passwordResetAttempt.findMany();
		return distinctSorted(rows.map((row) => row.ipAddress));
	},
};

const passwordReset: Caller = {
	name: "password reset",
	async send(init) {
		present(init);
		const { POST } = await import("@/app/api/auth/reset-password/route");
		return await POST(
			postJson("/api/auth/reset-password", {
				token: `not-a-token-${nextNumber()}`,
				password: PASSWORD,
			})
		);
	},
	recorded: () => auditAddresses("password_reset_invalid_token"),
};

const inviteAcceptance: Caller = {
	name: "invite acceptance",
	async send(init) {
		present(init);
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const { POST } = await import("@/app/api/invites/[token]/accept/route");
		return await POST(postJson("/api/invites/bogus/accept", {}), {
			params: Promise.resolve({ token: "bogus" }),
		});
	},
	recorded: () => attemptAddresses("invite_accept"),
};

const pipelineSignIn: Caller = {
	name: "pipeline sign-in",
	async send(init) {
		return await whoamiGET(
			new NextRequest("http://localhost:3000/api/machine/whoami", {
				headers: {
					authorization: `Bearer ${TOKEN_PREFIX}does-not-exist`,
					...init,
				},
			})
		);
	},
	recorded: () => attemptAddresses("machine_auth"),
};

export const callers: Caller[] = [
	registration,
	passwordResetRequest,
	passwordReset,
	inviteAcceptance,
	pipelineSignIn,
];

/**
 * Callers with a per-address limit. Password reset requests allow ten per
 * address per hour; that limit is private to its service, so it is written
 * here.
 */
export const limitedCallers: LimitedCaller[] = [
	{
		caller: registration,
		attempts: RATE_LIMIT_CONFIGS.register.limits[0].maxAttempts,
	},
	{ caller: passwordResetRequest, attempts: 10 },
	{
		caller: inviteAcceptance,
		attempts: RATE_LIMIT_CONFIGS.inviteAccept.limits[0].maxAttempts,
	},
	{
		caller: pipelineSignIn,
		attempts: RATE_LIMIT_CONFIGS.machineAuth.limits[0].maxAttempts,
	},
];

export type Outcome = "allowed" | "paused";

/**
 * What each of `count` requests got: paused (429) or allowed (anything else),
 * with the headers of each chosen by its index from 1.
 */
export async function outcomesOf(
	caller: Caller,
	count: number,
	headersFor: (index: number) => HeaderInit
): Promise<Outcome[]> {
	const outcomes: Outcome[] = [];
	for (let index = 1; index <= count; index++) {
		const response = await caller.send(headersFor(index));
		outcomes.push(response.status === 429 ? "paused" : "allowed");
	}
	return outcomes;
}

/** The outcomes of a visitor who uses the whole budget and then one more. */
export function allowedThenPaused(attempts: number): Outcome[] {
	return [...new Array<Outcome>(attempts).fill("allowed"), "paused"];
}

/** The outcomes of `count` attempts none of which is paused. */
export function neverPaused(count: number): Outcome[] {
	return new Array<Outcome>(count).fill("allowed");
}
