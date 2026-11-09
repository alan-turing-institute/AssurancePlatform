import { timingSafeEqual } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CLOUDFLARE_V4,
	SECRET,
	setOriginSecretForEachTest,
	throughCloudflare,
	VISITOR_V4,
} from "@/src/__tests__/helpers/cloudflare-headers";
import { extractClientIp } from "../extract-client-ip";

/**
 * The origin secret is compared with `crypto.timingSafeEqual`, so the time a
 * request takes does not reveal how much of a guess was right. The answer
 * itself is covered elsewhere; this pins the way it is reached.
 */

vi.mock("node:crypto", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:crypto")>();
	const timingSafeEqual = vi.fn(actual.timingSafeEqual);
	return {
		...actual,
		timingSafeEqual,
		default: { ...actual, timingSafeEqual },
	};
});

const SAME_LENGTH_WRONG = "x".repeat(SECRET.length);

function presenting(value: string): Headers {
	return throughCloudflare({ "x-origin-verify": value });
}

setOriginSecretForEachTest();

beforeEach(() => {
	vi.mocked(timingSafeEqual).mockClear();
});

describe("the origin secret comparison", () => {
	it("goes through crypto.timingSafeEqual for the correct secret", () => {
		extractClientIp(presenting(SECRET));

		expect(timingSafeEqual).toHaveBeenCalled();
	});

	it("goes through crypto.timingSafeEqual for a wrong value as long as the secret", () => {
		extractClientIp(presenting(SAME_LENGTH_WRONG));

		expect(timingSafeEqual).toHaveBeenCalled();
	});

	it("still answers correctly with the comparison in place", () => {
		expect(extractClientIp(presenting(SECRET))).toBe(VISITOR_V4);
		expect(extractClientIp(presenting(SAME_LENGTH_WRONG))).toBe(CLOUDFLARE_V4);
	});
});
