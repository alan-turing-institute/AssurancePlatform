import { describe, expect, it, vi } from "vitest";
import {
	CLOUDFLARE_V4,
	CLOUDFLARE_V6,
	type FieldValue,
	headersOf,
	OUTSIDE_CLOUDFLARE,
	SECRET,
	SETTING,
	setOriginSecretForEachTest,
	throughCloudflare,
	VISITOR_V4,
	visitorCountedAs,
} from "@/src/__tests__/helpers/cloudflare-headers";
import { extractClientIp } from "../extract-client-ip";

/**
 * Behind Turing's Cloudflare each visitor is counted by their own address, and
 * nobody can choose the counted address: `cf-connecting-ip` is used only when
 * `x-client-ip` is inside Cloudflare's ranges AND `x-origin-verify` equals the
 * `CLOUDFLARE_ORIGIN_SECRET` setting. A trusted IPv6 visitor is counted by
 * their /64 network. Anything else keeps the existing chain.
 */

setOriginSecretForEachTest();

describe("a request through Cloudflare that presents the origin secret", () => {
	it("counts the visitor from cf-connecting-ip, not the Cloudflare address", () => {
		expect(extractClientIp(throughCloudflare())).toBe(VISITOR_V4);
	});

	it("does so when Cloudflare connects over IPv6", () => {
		const headers = throughCloudflare({ "x-client-ip": CLOUDFLARE_V6 });

		expect(extractClientIp(headers)).toBe(VISITOR_V4);
	});

	it("takes the header value without the whitespace HTTP puts around it", () => {
		const headers = throughCloudflare({ "x-origin-verify": `  ${SECRET}\t` });

		expect(extractClientIp(headers)).toBe(VISITOR_V4);
	});

	it.each([
		["a trailing newline", `${SECRET}\n`],
		["surrounding spaces", `  ${SECRET} `],
	])("accepts a setting stored with %s", (_label, setting) => {
		vi.stubEnv(SETTING, setting);

		expect(extractClientIp(throughCloudflare())).toBe(VISITOR_V4);
	});

	it("reads the setting on every call", () => {
		expect(extractClientIp(throughCloudflare())).toBe(VISITOR_V4);

		vi.stubEnv(SETTING, "a-replacement-secret");
		expect(extractClientIp(throughCloudflare())).toBe(CLOUDFLARE_V4);

		vi.stubEnv(SETTING, SECRET);
		expect(extractClientIp(throughCloudflare())).toBe(VISITOR_V4);
	});
});

describe("a wrong origin secret is never accepted", () => {
	const wrongSecrets: readonly [string, string | readonly string[]][] = [
		["a different value of the same length", "x".repeat(SECRET.length)],
		["a prefix of the secret", SECRET.slice(0, -1)],
		["the secret with a character added at the end", `${SECRET}x`],
		["the secret with a character added at the start", `x${SECRET}`],
		["the secret with its first character changed", `P${SECRET.slice(1)}`],
		["the secret with its last character changed", `${SECRET.slice(0, -1)}Y`],
		[
			"the secret with a middle character changed",
			`${SECRET.slice(0, 17)}!${SECRET.slice(18)}`,
		],
		["the secret in upper case", SECRET.toUpperCase()],
		["the secret in lower case", SECRET.toLowerCase()],
		["the secret with one letter's case changed", SECRET.replace("O", "o")],
		[
			"the secret with a space inside",
			`${SECRET.slice(0, 5)} ${SECRET.slice(5)}`,
		],
		["a wrong value then the secret, sent as two fields", ["wrong", SECRET]],
		["the secret then a wrong value, sent as two fields", [SECRET, "wrong"]],
		["the secret sent twice as two fields", [SECRET, SECRET]],
		["the secret twice in one comma-separated field", `${SECRET}, ${SECRET}`],
		["a wrong value then the secret in one field", `wrong, ${SECRET}`],
		["the secret then a wrong value in one field", `${SECRET}, wrong`],
	];

	it.each(wrongSecrets)("%s", (_label, presented) => {
		const headers = throughCloudflare({ "x-origin-verify": presented });

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});

	it("is not rescued by a correct secret in some other header", () => {
		const headers = throughCloudflare({
			"x-origin-verify": undefined,
			"x-origin-secret": SECRET,
			"x-forwarded-origin-verify": SECRET,
		});

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});

	it("is not accepted when the header is missing", () => {
		const headers = throughCloudflare({ "x-origin-verify": undefined });

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});
});

describe("with the setting unset, empty or only whitespace", () => {
	const unusableSettings = [undefined, "", " ", "    ", "\n", "\t", " \r\n "];
	const presentations: readonly FieldValue[] = [
		undefined,
		"",
		" ",
		"undefined",
		"null",
		"\t",
	];

	it.each(
		unusableSettings
	)("never reads cf-connecting-ip (setting %j)", (setting) => {
		vi.stubEnv(SETTING, setting);

		for (const presented of presentations) {
			const headers = throughCloudflare({ "x-origin-verify": presented });
			expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
		}
	});

	it("never reads cf-connecting-ip when the header repeats the setting itself", () => {
		vi.stubEnv(SETTING, "   ");

		const headers = throughCloudflare({ "x-origin-verify": "   " });

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});
});

describe("a correct origin secret from outside Cloudflare's ranges", () => {
	const connectingAddresses = [
		OUTSIDE_CLOUDFLARE,
		"10.0.0.1",
		"127.0.0.1",
		"203.0.113.7",
		"2001:db8::1",
		"::1",
		`::ffff:${OUTSIDE_CLOUDFLARE}`,
	];

	it.each(
		connectingAddresses
	)("leaves the visitor counted by the connecting address %s", (connecting) => {
		const headers = throughCloudflare({
			"x-client-ip": connecting,
			"cf-connecting-ip": "192.0.2.99",
		});

		expect(extractClientIp(headers)).toBe(connecting);
	});

	it("is not used when x-client-ip is absent, even if x-forwarded-for names a Cloudflare address", () => {
		const headers = throughCloudflare({
			"x-client-ip": undefined,
			"x-forwarded-for": `198.51.100.1, ${CLOUDFLARE_V4}:4433`,
		});

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});

	it("is not used when x-client-ip is absent and nothing else names a client", () => {
		const headers = throughCloudflare({ "x-client-ip": undefined });

		expect(extractClientIp(headers)).toBe("unknown");
	});

	it("does not trust an x-client-ip that only contains a Cloudflare address", () => {
		const headers = throughCloudflare({
			"x-client-ip": `${CLOUDFLARE_V4}, ${OUTSIDE_CLOUDFLARE}`,
		});

		expect(extractClientIp(headers)).toBe(
			`${CLOUDFLARE_V4}, ${OUTSIDE_CLOUDFLARE}`
		);
	});
});

describe("a Cloudflare address with the secret but an unusable cf-connecting-ip", () => {
	const unusable: readonly [string, FieldValue][] = [
		["missing", undefined],
		["empty", ""],
		["blank", "   "],
		["not an address", "not-an-ip"],
		["the word unknown", "unknown"],
		["a list in one field", `${VISITOR_V4}, 198.51.100.1`],
		["a list sent as two fields", [VISITOR_V4, "198.51.100.1"]],
		["a list separated by a space", `${VISITOR_V4} 198.51.100.1`],
		["an address with a port", `${VISITOR_V4}:443`],
		["a bracketed IPv6 address", "[2001:db8::1]"],
		["a network, not an address", "203.0.113.0/24"],
		["an IPv6 network", "2001:db8::/64"],
		["an octet out of range", "203.0.113.256"],
		["too few octets", "203.0.113"],
		["a hostname", "visitor.example.com"],
		["trailing text", `${VISITOR_V4}abc`],
		["a decimal integer", "3405803783"],
		["a hexadecimal integer", "0xcb007107"],
		["an IPv6 address with a bad group", "2001:db8::g"],
		["an IPv6 address with too many groups", "1:2:3:4:5:6:7:8:9"],
	];

	it.each(
		unusable
	)("counts the connecting address when it is %s", (_label, value) => {
		const headers = throughCloudflare({ "cf-connecting-ip": value });

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});
});

describe("when the secret rule does not apply the existing chain is unchanged", () => {
	it("returns x-client-ip, ignoring cf-connecting-ip, with no secret presented", () => {
		const headers = headersOf({
			"x-client-ip": CLOUDFLARE_V4,
			"cf-connecting-ip": VISITOR_V4,
			"x-forwarded-for": "198.51.100.1, 198.51.100.2:80",
		});

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});

	it("returns the rightmost x-forwarded-for entry without its port, ignoring cf-connecting-ip", () => {
		const headers = headersOf({
			"cf-connecting-ip": VISITOR_V4,
			"x-origin-verify": SECRET,
			"x-forwarded-for": "198.51.100.1, 198.51.100.2:80",
		});

		expect(extractClientIp(headers)).toBe("198.51.100.2");
	});

	it("returns 'unknown' when no address header is present", () => {
		const headers = headersOf({
			"cf-connecting-ip": VISITOR_V4,
			"x-origin-verify": SECRET,
		});

		expect(extractClientIp(headers)).toBe("unknown");
	});

	it("returns an IPv6 x-client-ip outside Cloudflare in full, not reduced to a network", () => {
		const address = "2001:db8:aaaa:bbbb:cccc:dddd:eeee:ffff";
		const headers = throughCloudflare({ "x-client-ip": address });

		expect(extractClientIp(headers)).toBe(address);
	});

	it("returns a Cloudflare IPv6 x-client-ip in full when the secret is not accepted", () => {
		const address = "2606:4700:1:2:3:4:5:6";
		const headers = throughCloudflare({
			"x-client-ip": address,
			"x-origin-verify": "wrong",
		});

		expect(extractClientIp(headers)).toBe(address);
	});

	it("does not take a visitor from cf-connecting-ip sent on its own", () => {
		const headers = headersOf({ "cf-connecting-ip": VISITOR_V4 });

		expect(extractClientIp(headers)).toBe("unknown");
	});
});

describe("an IPv4 visitor", () => {
	it("is counted by their own address, in dotted form", () => {
		expect(visitorCountedAs("192.0.2.45")).toBe("192.0.2.45");
	});

	it("is counted the same way whatever the connecting Cloudflare address", () => {
		const viaV6 = throughCloudflare({
			"x-client-ip": CLOUDFLARE_V6,
			"cf-connecting-ip": "192.0.2.45",
		});

		expect(extractClientIp(viaV6)).toBe("192.0.2.45");
	});
});

describe("an IPv6 visitor is counted by their /64 network", () => {
	const sameNetworkAsAbsent = [
		"2001:db8:1:2::",
		"2001:db8:1:2::1",
		"2001:db8:1:2:0:0:0:0",
		"2001:0db8:0001:0002:0000:0000:0000:0001",
		"2001:DB8:1:2:AAAA:BBBB:CCCC:DDDD",
		"2001:db8:1:2:ffff:ffff:ffff:ffff",
		"2001:db8:1:2:8000::",
		"2001:db8:1:2::ffff:1.2.3.4",
		"2001:db8:1:2:3:4:5:6",
		"2001:db8:1:2:3:4:1.2.3.4",
	];

	it("gives one count to every address written inside the same /64", () => {
		const counted = new Set(sameNetworkAsAbsent.map(visitorCountedAs));

		expect(counted.size).toBe(1);
	});

	it("gives the same count whichever way the first four groups are written", () => {
		const spellings = [
			"2001:db8::",
			"2001:0db8:0000:0000:0000:0000:0000:0001",
			"2001:db8:0:0:5::7",
			"2001:DB8:0:0:ABCD::1",
			"2001:db8::5:0:0:1",
		];

		expect(new Set(spellings.map(visitorCountedAs)).size).toBe(1);
	});

	it("gives different counts to different /64 networks", () => {
		const networks = [
			"2001:db8:1:2::1",
			"2001:db8:1:3::1",
			"2001:db8:1:1::1",
			"2001:db8:2:2::1",
			"2001:db9:1:2::1",
			"2002:db8:1:2::1",
			"3001:db8:1:2::1",
			"2001:db8:0:0::1",
			"2001:db8::1:0:0:0:1",
		];

		expect(new Set(networks.map(visitorCountedAs)).size).toBe(networks.length);
	});

	it("tells apart networks that differ only in the last bit of the 64", () => {
		const last = visitorCountedAs("2001:db8:1:2::1");
		const next = visitorCountedAs("2001:db8:1:3::1");

		expect(last).not.toBe(next);
	});

	it("does not count the host part: addresses of one /64 never yield the full address", () => {
		const host = "2001:db8:1:2:aaaa:bbbb:cccc:dddd";

		expect(visitorCountedAs(host)).not.toContain("aaaa");
		expect(visitorCountedAs(host)).not.toContain("dddd");
	});

	it("counts the network as four full groups followed by ::/64", () => {
		expect(visitorCountedAs("2001:DB8:1:2:aaaa:bbbb:cccc:dddd")).toBe(
			"2001:0db8:0001:0002::/64"
		);
	});

	it("keeps an IPv6 network apart from every IPv4 address", () => {
		expect(visitorCountedAs("2001:db8::1")).not.toBe(
			visitorCountedAs(VISITOR_V4)
		);
	});

	it("does so for an IPv6 visitor arriving over an IPv4 Cloudflare connection", () => {
		const headers = throughCloudflare({
			"x-client-ip": CLOUDFLARE_V4,
			"cf-connecting-ip": "2001:db8:1:2::9",
		});
		const viaV6 = throughCloudflare({
			"x-client-ip": CLOUDFLARE_V6,
			"cf-connecting-ip": "2001:db8:1:2::a",
		});

		expect(extractClientIp(headers)).toBe(extractClientIp(viaV6));
	});
});

describe("an IPv4-mapped IPv6 visitor", () => {
	const forms = [
		"::ffff:203.0.113.7",
		"::FFFF:203.0.113.7",
		"::ffff:cb00:7107",
		"::FFFF:CB00:7107",
		"0:0:0:0:0:ffff:203.0.113.7",
		"0:0:0:0:0:ffff:cb00:7107",
		"0000:0000:0000:0000:0000:ffff:cb00:7107",
		"0::ffff:cb00:7107",
	];

	it.each(forms)("%s is counted as the IPv4 address it wraps", (form) => {
		expect(visitorCountedAs(form)).toBe(VISITOR_V4);
	});

	it("keeps different wrapped IPv4 addresses apart", () => {
		const counted = new Set(
			["::ffff:203.0.113.7", "::ffff:203.0.113.8", "::ffff:198.51.100.1"].map(
				visitorCountedAs
			)
		);

		expect(counted.size).toBe(3);
	});

	it("counts a mapped visitor and the same plain IPv4 visitor together", () => {
		expect(visitorCountedAs("::ffff:203.0.113.7")).toBe(
			visitorCountedAs(VISITOR_V4)
		);
	});

	it("does not fold other addresses that merely start with zeros into the mapped form", () => {
		const notMapped = [
			"::ffff:0:cb00:7107",
			"::cb00:7107",
			"0:0:0:1:0:ffff:cb00:7107",
		];

		for (const address of notMapped) {
			expect(visitorCountedAs(address)).not.toBe(VISITOR_V4);
		}
	});
});

describe("an IPv4-mapped connecting address", () => {
	it("is recognised as the Cloudflare address it wraps", () => {
		const headers = throughCloudflare({
			"x-client-ip": `::ffff:${CLOUDFLARE_V4}`,
		});

		expect(extractClientIp(headers)).toBe(VISITOR_V4);
	});

	it("is recognised in its hexadecimal form", () => {
		const headers = throughCloudflare({ "x-client-ip": "::ffff:6810:1" });

		expect(extractClientIp(headers)).toBe(VISITOR_V4);
	});

	it("is not trusted when the address it wraps is outside Cloudflare", () => {
		const connecting = `::ffff:${OUTSIDE_CLOUDFLARE}`;
		const headers = throughCloudflare({ "x-client-ip": connecting });

		expect(extractClientIp(headers)).toBe(connecting);
	});
});

describe("an IPv6 visitor written with a zone id", () => {
	it("is counted as the network the address names, not the zone", () => {
		expect(visitorCountedAs("2001:db8:1:2::1%eth0")).toBe(
			visitorCountedAs("2001:db8:1:2::1")
		);
	});

	it("is counted as the wrapped IPv4 address when the address is IPv4-mapped", () => {
		expect(visitorCountedAs("::ffff:203.0.113.7%eth0")).toBe(VISITOR_V4);
		expect(visitorCountedAs("::ffff:cb00:7107%2")).toBe(VISITOR_V4);
	});
});
