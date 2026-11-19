import { describe, expect, it } from "vitest";
import {
	SECRET,
	setOriginSecretForEachTest,
	throughCloudflare,
	VISITOR_V4,
} from "@/src/__tests__/helpers/cloudflare-headers";
import {
	CLOUDFLARE_RANGES,
	isInPublishedRanges,
	rangeEdges,
} from "@/src/__tests__/helpers/cloudflare-ranges";
import { extractClientIp } from "../extract-client-ip";

/**
 * Which connecting addresses count as Cloudflare, with the origin secret
 * presented. The visitor's own address is read only when `x-client-ip` is
 * inside Cloudflare's published ranges; every other request keeps the
 * existing chain.
 */

const EDGE = "173.245.48.5";
const VISITOR = VISITOR_V4;
const NOT_CLOUDFLARE = "203.0.113.5";

function behind(
	connecting: string,
	extra: Record<string, string> = {},
	secret: string | null = SECRET
): Headers {
	return throughCloudflare({
		"x-client-ip": connecting,
		"x-origin-verify": secret ?? undefined,
		...extra,
	});
}

setOriginSecretForEachTest();

describe("the edge of every published Cloudflare range", () => {
	const cases = CLOUDFLARE_RANGES.flatMap((cidr) =>
		rangeEdges(cidr).map((edge) => ({ cidr, ...edge }))
	);

	it.each(cases)("$cidr, $label ($address), with the secret", ({ address }) => {
		const expected = isInPublishedRanges(address) ? VISITOR : address;

		expect(extractClientIp(behind(address))).toBe(expected);
	});

	it.each(cases)("$cidr, $label ($address), without the secret", ({
		address,
	}) => {
		expect(extractClientIp(behind(address, {}, null))).toBe(address);
	});
});

describe("forms of the connecting address, with the secret", () => {
	const forms: [string, string, boolean][] = [
		["IPv4 inside a range", EDGE, true],
		["IPv6 compressed", "2606:4700::1", true],
		["IPv6 with every group written out", "2606:4700:0:0:0:0:0:1", true],
		["IPv6 with leading zeros in each group", "2606:4700:0000::0001", true],
		["IPv6 in upper case", "2606:4700::ABCD:1", true],
		["IPv4-mapped IPv6 of a Cloudflare address", "::ffff:173.245.48.5", true],
		["IPv4-mapped IPv6 of another address", "::ffff:8.8.8.8", false],
		[
			"IPv4-mapped IPv6 one past a Cloudflare range",
			"::ffff:173.245.64.0",
			false,
		],
		["IPv4 with a port", "173.245.48.5:443", false],
		["IPv6 in brackets", "[2606:4700::1]", false],
		["IPv6 in brackets with a port", "[2606:4700::1]:443", false],
		["IPv4 range text", "173.245.48.0/20", false],
		["two addresses", "173.245.48.5, 8.8.8.8", false],
		["an address with a hostname suffix", "173.245.48.5.example.test", false],
		["a hostname", "www.cloudflare.com", false],
		["localhost", "localhost", false],
		["IPv4 with leading zeros", "173.245.048.005", false],
		["an IPv6 address outside every range", "2606:4701::1", false],
	];

	it.each(forms)("%s", (_label, connecting, honoured) => {
		const result = extractClientIp(behind(connecting));

		expect(result).toBe(honoured ? VISITOR : connecting);
	});

	it("does not throw for an IPv6 address with a zone id", () => {
		for (const address of ["2606:4700::1%eth0", "fe80::1%eth0"]) {
			expect(() => extractClientIp(behind(address))).not.toThrow();
			expect([VISITOR, address]).toContain(extractClientIp(behind(address)));
		}
	});

	it("does not throw for a visitor address with a zone id", () => {
		const headers = behind(EDGE, {
			"cf-connecting-ip": "2001:db8:1:2::1%eth0",
		});

		expect(() => extractClientIp(headers)).not.toThrow();
	});

	it("reads the header names whatever their case", () => {
		const headers = new Headers({
			"X-Client-IP": EDGE,
			"CF-Connecting-IP": VISITOR,
			"X-Origin-Verify": SECRET,
		});

		expect(extractClientIp(headers)).toBe(VISITOR);
	});

	it("trims whitespace around the connecting address", () => {
		const headers = behind(`  ${EDGE}  `);

		expect(extractClientIp(headers)).toBe(VISITOR);
	});
});

describe("the visitor's own address, with the secret", () => {
	const visitors: [string, string, string][] = [
		["an IPv4 address", VISITOR, VISITOR],
		["an address with surrounding whitespace", `  ${VISITOR} `, VISITOR],
		["an IPv4 address with leading zeros", "203.000.113.077", EDGE],
		["a very long value", "9".repeat(10_000), EDGE],
	];

	it.each(visitors)("%s", (_label, header, expected) => {
		const result = extractClientIp(
			behind(EDGE, { "cf-connecting-ip": header })
		);

		expect(result).toBe(expected);
	});

	it("counts the connecting address, not x-forwarded-for, when the header is missing", () => {
		const headers = behind(EDGE, {
			"x-forwarded-for": "198.51.100.9, 192.0.2.1",
		});
		headers.delete("cf-connecting-ip");

		expect(extractClientIp(headers)).toBe(EDGE);
	});

	it("ignores a forged x-forwarded-for and other client headers", () => {
		const headers = behind(EDGE, {
			"x-forwarded-for": "198.51.100.9, 192.0.2.1",
			"x-real-ip": "192.0.2.2",
			"true-client-ip": "192.0.2.3",
			"cf-connecting-ipv6": "2001:db8::bad",
		});

		expect(extractClientIp(headers)).toBe(VISITOR);
	});

	it("counts two visitors behind one Cloudflare address separately", () => {
		const first = extractClientIp(
			behind(EDGE, { "cf-connecting-ip": "203.0.113.1" })
		);
		const second = extractClientIp(
			behind(EDGE, { "cf-connecting-ip": "203.0.113.2" })
		);

		expect([first, second]).toEqual(["203.0.113.1", "203.0.113.2"]);
	});

	it("counts one visitor reaching us through two Cloudflare addresses once", () => {
		const viaOne = extractClientIp(behind("173.245.48.5"));
		const viaTwo = extractClientIp(behind("2606:4700::1"));

		expect(viaOne).toBe(viaTwo);
	});
});

describe("a forged cf-connecting-ip from outside Cloudflare, with the secret", () => {
	const direct = [
		NOT_CLOUDFLARE,
		"10.0.0.1",
		"127.0.0.1",
		"::1",
		"2001:db8::5",
		"173.245.47.255",
		"173.245.64.0",
		"2606:4701::1",
		"::ffff:203.0.113.5",
	];

	it.each(direct)("is ignored when x-client-ip is %s", (address) => {
		expect(extractClientIp(behind(address))).toBe(address);
	});

	it("gives one count however the forged value rotates", () => {
		const results = new Set<string>();

		for (let index = 1; index <= 50; index++) {
			const forged = { "cf-connecting-ip": `198.51.100.${index}` };
			results.add(extractClientIp(behind(NOT_CLOUDFLARE, forged)));
		}

		expect([...results]).toEqual([NOT_CLOUDFLARE]);
	});

	it("gives one count however the forged value rotates, without the secret", () => {
		const results = new Set<string>();

		for (let index = 1; index <= 50; index++) {
			const forged = { "cf-connecting-ip": `198.51.100.${index}` };
			results.add(extractClientIp(behind(EDGE, forged, null)));
		}

		expect([...results]).toEqual([EDGE]);
	});

	it("does not let a forged value replace the x-forwarded-for fallback either", () => {
		const headers = new Headers({
			"cf-connecting-ip": VISITOR,
			"x-origin-verify": SECRET,
			"x-forwarded-for": "198.51.100.1, 203.0.113.9",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.9");
	});

	it("is not read when x-client-ip is blank", () => {
		const headers = behind("   ");

		expect(extractClientIp(headers)).toBe("unknown");
	});
});
