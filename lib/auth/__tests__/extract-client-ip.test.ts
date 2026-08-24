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
});
