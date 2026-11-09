import { describe, expect, it } from "vitest";
import { extractClientIp } from "../extract-client-ip";

function headersOf(entries: Record<string, string>): Headers {
	return new Headers(entries);
}

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
		it("returns the visitor's cf-connecting-ip when x-client-ip is a Cloudflare IPv4 address", () => {
			const headers = headersOf({
				"x-client-ip": "172.71.130.5",
				"x-forwarded-for": "172.71.130.5:4000",
				"cf-connecting-ip": "203.0.113.20",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.20");
		});

		it("returns an IPv6 visitor's cf-connecting-ip when x-client-ip is a Cloudflare IPv6 address", () => {
			const headers = headersOf({
				"x-client-ip": "2a06:98c0:3600::103",
				"cf-connecting-ip": "2001:db8::20",
			});

			expect(extractClientIp(headers)).toBe("2001:db8::20");
		});

		it("matches a Cloudflare address given as an IPv4-mapped IPv6 address", () => {
			const headers = headersOf({
				"x-client-ip": "::ffff:172.71.130.5",
				"cf-connecting-ip": "203.0.113.21",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.21");
		});

		it("ignores a forged cf-connecting-ip when x-client-ip is not a Cloudflare address", () => {
			const headers = headersOf({
				"x-client-ip": "203.0.113.5",
				"cf-connecting-ip": "198.51.100.77",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.5");
		});

		it("ignores cf-connecting-ip when there is no x-client-ip, however x-forwarded-for reads", () => {
			const headers = headersOf({
				"x-forwarded-for": "198.51.100.1, 172.71.130.5",
				"cf-connecting-ip": "198.51.100.77",
			});

			expect(extractClientIp(headers)).toBe("172.71.130.5");
		});

		it("falls back to the Cloudflare address when cf-connecting-ip is missing", () => {
			const headers = headersOf({ "x-client-ip": "172.71.130.5" });

			expect(extractClientIp(headers)).toBe("172.71.130.5");
		});

		it.each([
			["not an address", "not-an-ip"],
			["a list of addresses", "203.0.113.20, 198.51.100.1"],
			["an address with a port", "203.0.113.20:4000"],
			["blank", "   "],
		])("falls back to the Cloudflare address when cf-connecting-ip is %s", (_label, value) => {
			const headers = headersOf({
				"x-client-ip": "172.71.130.5",
				"cf-connecting-ip": value,
			});

			expect(extractClientIp(headers)).toBe("172.71.130.5");
		});

		it("trims whitespace around cf-connecting-ip", () => {
			const headers = headersOf({
				"x-client-ip": "172.71.130.5",
				"cf-connecting-ip": "  203.0.113.22 ",
			});

			expect(extractClientIp(headers)).toBe("203.0.113.22");
		});

		it("treats addresses just outside a Cloudflare range as not Cloudflare", () => {
			// 173.245.48.0/20 ends at 173.245.63.255.
			const inside = headersOf({
				"x-client-ip": "173.245.63.255",
				"cf-connecting-ip": "203.0.113.23",
			});
			const outside = headersOf({
				"x-client-ip": "173.245.64.0",
				"cf-connecting-ip": "203.0.113.23",
			});

			expect(extractClientIp(inside)).toBe("203.0.113.23");
			expect(extractClientIp(outside)).toBe("173.245.64.0");
		});
	});
});
