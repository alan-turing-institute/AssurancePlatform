import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	allowedThenPaused,
	DIRECT,
	type HeaderInit,
	type LimitedCaller,
	limitedCallers,
	neverPaused,
	type Outcome,
	outcomesOf,
	SECRET,
	SETTING,
	VISITOR,
	viaCloudflare,
} from "../utils/visitor-address-kit";

/**
 * The per-address limits count each visitor behind Cloudflare by their own
 * address, and nobody can choose the counted address. Each limit is driven
 * through the route that enforces it: a visitor who has used the whole budget
 * is paused on the next attempt, and attempts from other visitors are not.
 */

vi.mock("next/headers", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/headers")>()),
	headers: vi.fn(),
}));

vi.mock("@/lib/auth/validate-session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/validate-session")>()),
	validateSession: vi.fn().mockResolvedValue(null),
}));

const MAPPED_FORMS_OF_VISITOR = [
	"::ffff:198.51.100.10",
	"::ffff:c633:640a",
	"::FFFF:C633:640A",
	"0:0:0:0:0:ffff:198.51.100.10",
	"198.51.100.10",
];

/** Different spellings of addresses inside the one network 2001:db8:1:2::/64. */
function insideOneNetwork(index: number): string {
	return index % 2 === 0
		? `2001:db8:1:2:${index}::${index}`
		: `2001:0DB8:0001:0002:${index}:0:0:${index}`;
}

function visitorNumber(index: number): string {
	return `198.51.100.${index}`;
}

function mappedFormOfVisitor(index: number): string {
	return MAPPED_FORMS_OF_VISITOR[index % MAPPED_FORMS_OF_VISITOR.length] ?? "";
}

/** The outcomes of one attempt more than the budget. */
function overTheBudget(
	{ caller, attempts }: LimitedCaller,
	headersFor: (index: number) => HeaderInit
): Promise<Outcome[]> {
	return outcomesOf(caller, attempts + 1, headersFor);
}

beforeEach(() => {
	vi.stubEnv(SETTING, SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe.each(limitedCallers)("the limit on $caller.name", (limited) => {
	const paused = allowedThenPaused(limited.attempts);

	it("does not pause different visitors who share a Cloudflare address", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index))
		);

		expect(outcomes).toEqual(neverPaused(limited.attempts + 1));
	});

	it("does not pause visitors in different IPv6 networks who share a Cloudflare address", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(`2001:db8:1:${index}::1`)
		);

		expect(outcomes).toEqual(neverPaused(limited.attempts + 1));
	});

	it("pauses one visitor however many Cloudflare addresses they come through", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(VISITOR, { "x-client-ip": `173.245.48.${index}` })
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses an IPv6 visitor who changes address inside one /64", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(insideOneNetwork(index))
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses a visitor whose IPv4 address arrives in different IPv4-mapped forms", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(mappedFormOfVisitor(index))
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses a caller who rotates a forged cf-connecting-ip from outside Cloudflare", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index), { "x-client-ip": DIRECT })
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses a caller who rotates cf-connecting-ip without the origin secret", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index), { "x-origin-verify": undefined })
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses a caller who rotates cf-connecting-ip with a wrong origin secret", async () => {
		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index), { "x-origin-verify": `${SECRET}x` })
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses a caller who rotates cf-connecting-ip while the setting is unset", async () => {
		vi.stubEnv(SETTING, undefined);

		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index))
		);

		expect(outcomes).toEqual(paused);
	});

	it("pauses a caller who rotates cf-connecting-ip while the setting is only whitespace", async () => {
		vi.stubEnv(SETTING, "  ");

		const outcomes = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index), { "x-origin-verify": "  " })
		);

		expect(outcomes).toEqual(paused);
	});

	it("leaves a visitor's own budget untouched when a forger has used up the Cloudflare address's", async () => {
		const forging = await overTheBudget(limited, (index) =>
			viaCloudflare(visitorNumber(index), { "x-origin-verify": "wrong" })
		);
		const real = await limited.caller.send(viaCloudflare(VISITOR));

		expect(forging).toEqual(paused);
		expect(real.status).not.toBe(429);
	});
});
