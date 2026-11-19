import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CLOUDFLARE,
	CLOUDFLARE_V6,
	callers,
	DIRECT,
	type HeaderInit,
	OTHER_VISITOR,
	SECRET,
	SETTING,
	VISITOR,
	viaCloudflare,
} from "../utils/visitor-address-kit";

/**
 * Every caller of `extractClientIp` counts a visitor behind Cloudflare by the
 * visitor's own address when the request carries the origin secret, and by the
 * connecting address otherwise. Each caller is observed through the address its
 * own bookkeeping stored. Sign-in shares the same helper and is covered through
 * `extractClientIp` itself.
 */

vi.mock("next/headers", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/headers")>()),
	headers: vi.fn(),
}));

vi.mock("@/lib/auth/validate-session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/validate-session")>()),
	validateSession: vi.fn().mockResolvedValue(null),
}));

const VICTIM = "192.0.2.77";

interface Untrusted {
	/** The address the caller must store instead of the forged victim. */
	counted: string;
	init: HeaderInit;
	name: string;
	/** The setting for the request; null leaves it unset. */
	setting: string | null;
}

function forged(
	name: string,
	init: HeaderInit,
	counted: string,
	setting: string | null = SECRET
): Untrusted {
	return { name, init, counted, setting };
}

const untrusted: Untrusted[] = [
	forged(
		"the origin secret is not presented",
		viaCloudflare(VICTIM, { "x-origin-verify": undefined }),
		CLOUDFLARE
	),
	forged(
		"the origin secret is presented empty",
		viaCloudflare(VICTIM, { "x-origin-verify": "" }),
		CLOUDFLARE
	),
	forged(
		"the origin secret is wrong",
		viaCloudflare(VICTIM, { "x-origin-verify": `${SECRET}x` }),
		CLOUDFLARE
	),
	forged(
		"the origin secret is only a prefix of the setting",
		viaCloudflare(VICTIM, { "x-origin-verify": SECRET.slice(0, -1) }),
		CLOUDFLARE
	),
	forged(
		"the origin secret is in another case",
		viaCloudflare(VICTIM, { "x-origin-verify": SECRET.toUpperCase() }),
		CLOUDFLARE
	),
	forged(
		"the origin secret is sent twice",
		viaCloudflare(VICTIM, { "x-origin-verify": `${SECRET}, ${SECRET}` }),
		CLOUDFLARE
	),
	forged(
		"the setting is unset, though the secret is presented",
		viaCloudflare(VICTIM),
		CLOUDFLARE,
		null
	),
	forged(
		"the setting is empty and the header is empty",
		viaCloudflare(VICTIM, { "x-origin-verify": "" }),
		CLOUDFLARE,
		""
	),
	forged(
		"the setting is only whitespace and the header is whitespace",
		viaCloudflare(VICTIM, { "x-origin-verify": "   " }),
		CLOUDFLARE,
		"   "
	),
	forged(
		"the secret is right but the connecting address is not Cloudflare's",
		viaCloudflare(VICTIM, { "x-client-ip": DIRECT }),
		DIRECT
	),
	forged(
		"the secret is right but cf-connecting-ip is a list",
		viaCloudflare(`${VICTIM}, ${OTHER_VISITOR}`),
		CLOUDFLARE
	),
	forged(
		"the secret is right but cf-connecting-ip is not an address",
		viaCloudflare("not an address"),
		CLOUDFLARE
	),
	forged(
		"the secret is right but cf-connecting-ip is missing",
		viaCloudflare(VICTIM, { "cf-connecting-ip": undefined }),
		CLOUDFLARE
	),
];

beforeEach(() => {
	vi.stubEnv(SETTING, SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe.each(callers)("$name behind Cloudflare", (caller) => {
	it("counts a visitor by their own address", async () => {
		await caller.send(viaCloudflare(VISITOR));

		expect(await caller.recorded()).toEqual([VISITOR]);
	});

	it("counts a visitor by their own address when Cloudflare connects over IPv6", async () => {
		await caller.send(viaCloudflare(VISITOR, { "x-client-ip": CLOUDFLARE_V6 }));

		expect(await caller.recorded()).toEqual([VISITOR]);
	});

	it("counts two visitors behind one Cloudflare address separately", async () => {
		await caller.send(viaCloudflare(VISITOR));
		await caller.send(viaCloudflare(OTHER_VISITOR));

		expect(await caller.recorded()).toEqual([VISITOR, OTHER_VISITOR]);
	});

	it("counts an IPv4-mapped IPv6 visitor as the IPv4 address it wraps", async () => {
		await caller.send(viaCloudflare(`::ffff:${VISITOR}`));

		expect(await caller.recorded()).toEqual([VISITOR]);
	});

	it("counts an IPv6 visitor by their /64 network, however the address is written", async () => {
		const first = "2001:db8:1:2:aaaa:bbbb:cccc:dddd";
		const sameNetwork = "2001:0DB8:0001:0002::1";
		const otherNetwork = "2001:db8:1:3:aaaa:bbbb:cccc:dddd";

		await caller.send(viaCloudflare(first));
		await caller.send(viaCloudflare(sameNetwork));
		await caller.send(viaCloudflare(otherNetwork));

		const recorded = await caller.recorded();
		expect(recorded).toHaveLength(2);
		expect(recorded).not.toContain(first);
		expect(recorded).not.toContain(otherNetwork);
	});

	it.each(untrusted)("ignores a forged cf-connecting-ip when $name", async ({
		init,
		counted,
		setting,
	}) => {
		vi.stubEnv(SETTING, setting ?? undefined);

		await caller.send(init);

		expect(await caller.recorded()).toEqual([counted]);
	});
});
