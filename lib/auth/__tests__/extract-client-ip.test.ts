import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractClientIp } from "../extract-client-ip";

function headersOf(entries: Record<string, string>): Headers {
	return new Headers(entries);
}

const ORIGIN_SECRET = "origin-secret-0123456789abcdef";

describe("extractClientIp", () => {
	it("prefers x-client-ip over x-forwarded-for, even when both are present (spoof attempt)", () => {
		const headers = headersOf({
			"x-client-ip": "203.0.113.5",
			"x-forwarded-for": "198.51.100.1, 203.0.113.5",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.5");
	});

	it("uses x-client-ip alone when x-forwarded-for is absent", () => {
		const headers = headersOf({ "x-client-ip": "203.0.113.6" });

		expect(extractClientIp(headers)).toBe("203.0.113.6");
	});

	it("takes the rightmost entry of a comma-separated x-forwarded-for chain", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1, 70.41.3.18, 203.0.113.7",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.7");
	});

	it("strips the port from an IPv4:port rightmost entry", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1:4000, 203.0.113.8:5000",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.8");
	});

	it("strips the port and brackets from a [IPv6]:port rightmost entry", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1:4000, [2001:db8::1]:5000",
		});

		expect(extractClientIp(headers)).toBe("2001:db8::1");
	});

	it("returns a bare IPv6 rightmost entry untouched (no brackets, ambiguous port)", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1:4000, 2001:db8::1",
		});

		expect(extractClientIp(headers)).toBe("2001:db8::1");
	});

	it("returns 'unknown' when neither header is present", () => {
		const headers = headersOf({});

		expect(extractClientIp(headers)).toBe("unknown");
	});

	it("returns 'unknown' when x-forwarded-for is present but empty", () => {
		const headers = new Headers();
		headers.set("x-forwarded-for", "");

		expect(extractClientIp(headers)).toBe("unknown");
	});

	it("trims whitespace around the rightmost x-forwarded-for entry", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1 ,  203.0.113.9  ",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.9");
	});

	it("handles a single-entry x-forwarded-for with a port", () => {
		const headers = headersOf({ "x-forwarded-for": "203.0.113.10:9000" });

		expect(extractClientIp(headers)).toBe("203.0.113.10");
	});

	it("returns 'unknown' for a trailing comma (empty rightmost entry) — fails closed by design, no fallback to an earlier hop", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1, 203.0.113.7,",
		});

		expect(extractClientIp(headers)).toBe("unknown");
	});

	it("returns 'unknown' for a whitespace-only x-forwarded-for", () => {
		const headers = headersOf({ "x-forwarded-for": "   " });

		expect(extractClientIp(headers)).toBe("unknown");
	});

	it("falls through to x-forwarded-for when x-client-ip is present but empty", () => {
		const headers = headersOf({
			"x-client-ip": "",
			"x-forwarded-for": "198.51.100.1, 203.0.113.11",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.11");
	});

	it("strips the brackets from a [IPv6] rightmost entry with no port", () => {
		const headers = headersOf({
			"x-forwarded-for": "198.51.100.1, [2001:db8::1]",
		});

		expect(extractClientIp(headers)).toBe("2001:db8::1");
	});

	describe("behind Cloudflare", () => {
		beforeEach(() => {
			vi.stubEnv("CLOUDFLARE_ORIGIN_SECRET", ORIGIN_SECRET);
		});

		afterEach(() => {
			vi.unstubAllEnvs();
		});

		// A request through the site's Cloudflare zone carries the origin secret.
		function throughZone(entries: Record<string, string>): Headers {
			return headersOf({ "x-origin-verify": ORIGIN_SECRET, ...entries });
		}

		it("returns the visitor's cf-connecting-ip when x-client-ip is a Cloudflare IPv4 address", () => {
			const headers = throughZone({
				"x-client-ip": "172.71.130.5",
				"x-forwarded-for": "172.71.130.5:4000",
				"cf-connecting-ip": "203.0.113.20",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.20");
		});

		it("returns an IPv6 visitor's /64 network when x-client-ip is a Cloudflare IPv6 address", () => {
			const headers = throughZone({
				"x-client-ip": "2a06:98c0:3600::103",
				"cf-connecting-ip": "2001:db8::20",
			});

			expect(extractClientIp(headers)).toBe("2001:0db8:0000:0000::/64");
		});

		it("matches a Cloudflare address given as an IPv4-mapped IPv6 address", () => {
			const headers = throughZone({
				"x-client-ip": "::ffff:172.71.130.5",
				"cf-connecting-ip": "203.0.113.21",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.21");
		});

		it("ignores a forged cf-connecting-ip when x-client-ip is not a Cloudflare address", () => {
			const headers = throughZone({
				"x-client-ip": "203.0.113.5",
				"cf-connecting-ip": "198.51.100.77",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.5");
		});

		it("ignores cf-connecting-ip when there is no x-client-ip, however x-forwarded-for reads", () => {
			const headers = throughZone({
				"x-forwarded-for": "198.51.100.1, 172.71.130.5",
				"cf-connecting-ip": "198.51.100.77",
			});

			expect(extractClientIp(headers)).toBe("172.71.130.5");
		});

		it("falls back to the Cloudflare address when cf-connecting-ip is missing", () => {
			const headers = throughZone({ "x-client-ip": "172.71.130.5" });

			expect(extractClientIp(headers)).toBe("172.71.130.5");
		});

		it.each([
			["not an address", "not-an-ip"],
			["a list of addresses", "203.0.113.20, 198.51.100.1"],
			["an address with a port", "203.0.113.20:4000"],
			["blank", "   "],
		])("falls back to the Cloudflare address when cf-connecting-ip is %s", (_label, value) => {
			const headers = throughZone({
				"x-client-ip": "172.71.130.5",
				"cf-connecting-ip": value,
			});

			expect(extractClientIp(headers)).toBe("172.71.130.5");
		});

		it("trims whitespace around cf-connecting-ip", () => {
			const headers = throughZone({
				"x-client-ip": "172.71.130.5",
				"cf-connecting-ip": "  203.0.113.22 ",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.22");
		});

		it("treats addresses just outside a Cloudflare range as not Cloudflare", () => {
			// 173.245.48.0/20 ends at 173.245.63.255.
			const inside = throughZone({
				"x-client-ip": "173.245.63.255",
				"cf-connecting-ip": "203.0.113.23",
			});
			const outside = throughZone({
				"x-client-ip": "173.245.64.0",
				"cf-connecting-ip": "203.0.113.23",
			});

			expect(extractClientIp(inside)).toBe("203.0.113.23");
			expect(extractClientIp(outside)).toBe("173.245.64.0");
		});

		describe("the origin secret", () => {
			const request = {
				"x-client-ip": "172.71.130.5",
				"cf-connecting-ip": "203.0.113.30",
			};

			it("does not trust cf-connecting-ip when x-origin-verify is missing", () => {
				expect(extractClientIp(headersOf(request))).toBe("172.71.130.5");
			});

			it("does not trust cf-connecting-ip when x-origin-verify is wrong", () => {
				const headers = headersOf({
					...request,
					"x-origin-verify": "origin-secret-0123456789abcdeX",
				});

				expect(extractClientIp(headers)).toBe("172.71.130.5");
			});

			it.each([
				["a prefix of the secret", ORIGIN_SECRET.slice(0, -1)],
				["the secret with extra characters", `${ORIGIN_SECRET}0`],
				["blank", "   "],
			])("does not trust cf-connecting-ip when x-origin-verify is %s", (_label, value) => {
				const headers = headersOf({ ...request, "x-origin-verify": value });

				expect(extractClientIp(headers)).toBe("172.71.130.5");
			});

			it("trusts cf-connecting-ip when x-origin-verify is the secret", () => {
				const headers = headersOf({
					...request,
					"x-origin-verify": ORIGIN_SECRET,
				});

				expect(extractClientIp(headers)).toBe("203.0.113.30");
			});

			it("does not trust cf-connecting-ip when the secret is not configured, even if x-origin-verify is sent", () => {
				vi.stubEnv("CLOUDFLARE_ORIGIN_SECRET", undefined);
				const headers = headersOf({
					...request,
					"x-origin-verify": ORIGIN_SECRET,
				});

				expect(extractClientIp(headers)).toBe("172.71.130.5");
			});

			it("does not trust cf-connecting-ip when the secret is empty, even if x-origin-verify is empty too", () => {
				vi.stubEnv("CLOUDFLARE_ORIGIN_SECRET", "");
				const headers = new Headers({ ...request });
				headers.set("x-origin-verify", "");

				expect(extractClientIp(headers)).toBe("172.71.130.5");
			});

			it("does not trust cf-connecting-ip when x-origin-verify is right but x-client-ip is not a Cloudflare address", () => {
				const headers = headersOf({
					"x-client-ip": "203.0.113.5",
					"cf-connecting-ip": "198.51.100.77",
					"x-origin-verify": ORIGIN_SECRET,
				});

				expect(extractClientIp(headers)).toBe("203.0.113.5");
			});

			it("reads the setting on each call", () => {
				const headers = headersOf({
					...request,
					"x-origin-verify": ORIGIN_SECRET,
				});
				vi.stubEnv("CLOUDFLARE_ORIGIN_SECRET", undefined);
				const before = extractClientIp(headers);
				vi.stubEnv("CLOUDFLARE_ORIGIN_SECRET", ORIGIN_SECRET);
				const after = extractClientIp(headers);

				expect([before, after]).toEqual(["172.71.130.5", "203.0.113.30"]);
			});
		});

		describe("an IPv6 visitor", () => {
			function visitorAt(address: string): string {
				return extractClientIp(
					throughZone({
						"x-client-ip": "2a06:98c0:3600::103",
						"cf-connecting-ip": address,
					})
				);
			}

			it("is counted by /64 network, the same for compressed and expanded forms of addresses in it", () => {
				const forms = [
					"2001:db8::",
					"2001:db8::1",
					"2001:db8:0:0:ffff:ffff:ffff:ffff",
					"2001:0DB8:0000:0000:0000:0000:0000:0001",
					"2001:db8:0:0::7",
				];

				expect(new Set(forms.map(visitorAt))).toEqual(
					new Set(["2001:0db8:0000:0000::/64"])
				);
			});

			it("is counted separately when the /64 network differs", () => {
				const networks = [
					"2001:db8:0:0::1",
					"2001:db8:0:1::1",
					"2001:db8:1:0::1",
					"2001:db9:0:0::1",
					"2002:db8:0:0::1",
					"2001:db8:0:ffff::1",
				];

				const counted = networks.map(visitorAt);

				expect(new Set(counted).size).toBe(networks.length);
			});

			it("is counted by the first four groups, written in full", () => {
				expect(visitorAt("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe(
					"2001:0db8:85a3:08d3::/64"
				);
				expect(visitorAt("fe80:1:2:3::1")).toBe("fe80:0001:0002:0003::/64");
			});

			it("is counted as an IPv4 visitor when the address is IPv4-mapped", () => {
				const mapped = visitorAt("::ffff:203.0.113.44");
				const mappedHex = visitorAt("::FFFF:cb00:712c");

				expect(mapped).toBe("203.0.113.44");
				expect(mappedHex).toBe("203.0.113.44");
			});

			it("does not change an IPv4 visitor's address", () => {
				expect(visitorAt("203.0.113.44")).toBe("203.0.113.44");
			});
		});
	});
});
