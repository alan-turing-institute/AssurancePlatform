import { describe, expect, it } from "vitest";
import {
	type MediaFetchResult,
	mediaEtag,
	mediaResponse,
	mediaVersionToken,
} from "@/lib/media-response";

const ETAG = '"abc123"';

function okResult(): MediaFetchResult {
	return {
		status: "ok",
		data: Buffer.from([1, 2, 3, 4, 5]),
		contentType: "image/png",
		etag: ETAG,
	};
}

describe("mediaEtag and mediaVersionToken", () => {
	it("derive a quoted full hash and a 12-character token from the key", () => {
		expect(mediaEtag("cases/1/case-information/a.png")).toBe(
			'"dcf087a9197822250adccc1c00cfe4496954fc48"'
		);
		expect(mediaVersionToken("cases/1/case-information/a.png")).toBe(
			"dcf087a91978"
		);
	});

	it("gives the same value for the same key and different values for different keys", () => {
		expect(mediaEtag("cases/1/case-information/a.png")).toBe(
			mediaEtag("cases/1/case-information/a.png")
		);
		expect(mediaEtag("cases/2/case-information/b.png")).toBe(
			'"aafa458373dfc0fffa4a0152c9e115f7bade6fc8"'
		);
		expect(mediaVersionToken("cases/2/case-information/b.png")).toBe(
			"aafa458373df"
		);
	});
});

describe("mediaResponse: refusals", () => {
	it.each([
		"forbidden",
		"not-found",
	] as const)("answers %s with an identical empty 404", async (status) => {
		const response = mediaResponse({ status });
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
		expect([...response.headers.keys()]).toStrictEqual([]);
	});

	it("ignores the conditional header on a refusal", () => {
		const response = mediaResponse(
			{ status: "not-found" },
			{ ifNoneMatch: ETAG, cacheControl: "public" }
		);
		expect(response.status).toBe(404);
		expect(response.headers.get("etag")).toBeNull();
	});
});

describe("mediaResponse: served bytes", () => {
	it("sends the bytes with the type, length, nosniff, default cache control and tag", async () => {
		const response = mediaResponse(okResult());
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("content-length")).toBe("5");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("cache-control")).toBe("private, no-cache");
		expect(response.headers.get("etag")).toBe(ETAG);
		expect([...new Uint8Array(await response.arrayBuffer())]).toStrictEqual([
			1, 2, 3, 4, 5,
		]);
	});

	it("uses the cache control the caller gives", () => {
		const response = mediaResponse(okResult(), {
			cacheControl: "public, max-age=60",
		});
		expect(response.headers.get("cache-control")).toBe("public, max-age=60");
	});

	it("serves the bytes when no tag, a null tag or a different tag is sent", () => {
		for (const options of [
			{},
			{ ifNoneMatch: null },
			{ ifNoneMatch: "" },
			{ ifNoneMatch: '"other"' },
		]) {
			expect(mediaResponse(okResult(), options).status).toBe(200);
		}
	});
});

describe("mediaResponse: conditional requests", () => {
	it("answers a matching tag with a bare 304 that carries the tag and cache control", async () => {
		const response = mediaResponse(okResult(), { ifNoneMatch: ETAG });
		expect(response.status).toBe(304);
		expect(response.headers.get("etag")).toBe(ETAG);
		expect(response.headers.get("cache-control")).toBe("private, no-cache");
		expect(response.headers.get("content-type")).toBeNull();
		expect(await response.text()).toBe("");
	});

	it("uses the caller's cache control on a 304", () => {
		const response = mediaResponse(okResult(), {
			ifNoneMatch: ETAG,
			cacheControl: "public, max-age=60",
		});
		expect(response.status).toBe(304);
		expect(response.headers.get("cache-control")).toBe("public, max-age=60");
	});
});
