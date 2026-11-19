import { afterEach, beforeEach, vi } from "vitest";
import { extractClientIp } from "@/lib/auth/extract-client-ip";

/**
 * Request headers for `extractClientIp` tests: a request that reached the app
 * from a Cloudflare address, carrying the origin secret and a visitor's
 * address, which a test then spoils one field at a time.
 */

export const SETTING = "CLOUDFLARE_ORIGIN_SECRET";
export const SECRET = "Origin-Secret-0123456789-abcdefXYZ";
export const CLOUDFLARE_V4 = "104.16.0.1";
export const CLOUDFLARE_V6 = "2606:4700::1";
export const VISITOR_V4 = "203.0.113.7";
export const OUTSIDE_CLOUDFLARE = "198.51.100.20";

export type FieldValue = string | readonly string[] | undefined;

/** Builds headers, appending a repeated field once per value. */
export function headersOf(fields: Record<string, FieldValue>): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(fields)) {
		for (const each of [value ?? []].flat()) {
			headers.append(name, each);
		}
	}
	return headers;
}

/** A request that reached the app from a Cloudflare address with the secret. */
export function throughCloudflare(
	overrides: Record<string, FieldValue> = {}
): Headers {
	return headersOf({
		"x-client-ip": CLOUDFLARE_V4,
		"cf-connecting-ip": VISITOR_V4,
		"x-origin-verify": SECRET,
		...overrides,
	});
}

/** The address a visitor named in `cf-connecting-ip` is counted under. */
export function visitorCountedAs(address: string): string {
	return extractClientIp(throughCloudflare({ "cf-connecting-ip": address }));
}

/** Sets the origin secret setting for each test and restores it afterwards. */
export function setOriginSecretForEachTest(): void {
	beforeEach(() => {
		vi.stubEnv(SETTING, SECRET);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});
}
