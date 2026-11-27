import { describe, expect, it } from "vitest";
import {
	CLOUDFLARE_V4,
	headersOf,
	setOriginSecretForEachTest,
	throughCloudflare,
	VISITOR_V4,
} from "@/src/__tests__/helpers/cloudflare-headers";
import { extractClientIp } from "../extract-client-ip";

/**
 * `Headers` itself removes spaces, tabs and line breaks around a value. These
 * tests use padding it keeps (a non-breaking space, a form feed), so the
 * helper's own trimming is what decides the answer.
 */

const NBSP = " ";
const FORM_FEED = "\f";

setOriginSecretForEachTest();

describe("an x-client-ip value padded with characters Headers keeps", () => {
	it("is read without the padding", () => {
		const headers = headersOf({
			"x-client-ip": `${NBSP}203.0.113.5${FORM_FEED}`,
		});

		expect(extractClientIp(headers)).toBe("203.0.113.5");
	});

	it("counts as blank, so the x-forwarded-for chain is used", () => {
		const headers = headersOf({
			"x-client-ip": `${NBSP}${FORM_FEED}`,
			"x-forwarded-for": "198.51.100.1, 203.0.113.9",
		});

		expect(extractClientIp(headers)).toBe("203.0.113.9");
	});

	it("counts as blank, so the answer is 'unknown' when nothing else names a client", () => {
		const headers = headersOf({ "x-client-ip": NBSP });

		expect(extractClientIp(headers)).toBe("unknown");
	});
});

describe("a cf-connecting-ip value padded with characters Headers keeps", () => {
	it("is read without the padding when the request is trusted", () => {
		const headers = throughCloudflare({
			"cf-connecting-ip": `${NBSP}${VISITOR_V4}${FORM_FEED}`,
		});

		expect(extractClientIp(headers)).toBe(VISITOR_V4);
	});

	it("counts as blank, so the connecting address is used", () => {
		const headers = throughCloudflare({ "cf-connecting-ip": NBSP });

		expect(extractClientIp(headers)).toBe(CLOUDFLARE_V4);
	});
});
