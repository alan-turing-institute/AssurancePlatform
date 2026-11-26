import { createRequire } from "node:module";
import { streamText } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOWNLOAD_REFUSED_MESSAGE, noDownload } from "../no-download";

const HTTPS_URLS = /^https:\/\//;
const HTTP_URLS = /^http:\/\//;
const UNSUPPORTED = new URL("http://files.invalid/private/report.txt");
const SUPPORTED = new URL("https://files.invalid/pictures/chart.png");

/** The undici module the AI SDK's own downloader loads. */
const undici = createRequire(import.meta.url)("undici") as {
	fetch: typeof fetch;
};

const USAGE = {
	inputTokens: {
		total: 1,
		noCache: 1,
		cacheRead: undefined,
		cacheWrite: undefined,
	},
	outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/** Spies on every route by which a server-side download could leave the process. */
function watchFetches() {
	return [vi.spyOn(globalThis, "fetch"), vi.spyOn(undici, "fetch")].map((spy) =>
		spy.mockRejectedValue(new Error("no request expected"))
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("noDownload", () => {
	it("passes a URL the model takes directly through, as null", async () => {
		const result = await noDownload([
			{ url: SUPPORTED, isUrlSupportedByModel: true },
		]);

		expect(result).toEqual([null]);
	});

	it("refuses a URL the model does not take, with a message that does not name it", async () => {
		const error = await noDownload([
			{ url: UNSUPPORTED, isUrlSupportedByModel: false },
		]).then(
			() => null,
			(e: unknown) => e
		);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(DOWNLOAD_REFUSED_MESSAGE);
		expect(DOWNLOAD_REFUSED_MESSAGE).not.toContain("files.invalid");
	});

	it("refuses the whole request when only some of the URLs are supported", async () => {
		await expect(
			noDownload([
				{ url: SUPPORTED, isUrlSupportedByModel: true },
				{ url: UNSUPPORTED, isUrlSupportedByModel: false },
			])
		).rejects.toThrow(DOWNLOAD_REFUSED_MESSAGE);
	});

	it("never fetches, whether it passes a URL through or refuses it", async () => {
		const spies = watchFetches();

		await noDownload([{ url: SUPPORTED, isUrlSupportedByModel: true }]);
		await noDownload([{ url: UNSUPPORTED, isUrlSupportedByModel: false }]).then(
			undefined,
			() => undefined
		);

		for (const spy of spies) {
			expect(spy).not.toHaveBeenCalled();
		}
	});
});

describe("noDownload inside streamText", () => {
	function stream(supportedUrls: Record<string, RegExp[]>) {
		const model = new MockLanguageModelV3({
			supportedUrls,
			doStream: {
				stream: simulateReadableStream({
					chunks: [
						{ type: "stream-start" as const, warnings: [] },
						{ type: "text-start" as const, id: "t1" },
						{ type: "text-delta" as const, id: "t1", delta: "ok" },
						{ type: "text-end" as const, id: "t1" },
						{
							type: "finish" as const,
							finishReason: { unified: "stop" as const, raw: undefined },
							usage: USAGE,
						},
					],
				}),
			},
		});
		const errors: unknown[] = [];
		const result = streamText({
			model,
			experimental_download: noDownload,
			onError: ({ error }) => {
				errors.push(error);
			},
			messages: [
				{
					role: "user",
					content: [
						{ type: "file", mediaType: "image/png", data: SUPPORTED },
						{ type: "file", mediaType: "text/plain", data: UNSUPPORTED },
					],
				},
			],
		});
		return { model, result, errors };
	}

	it("fails a call whose file URL the model does not take, without a request or a model call", async () => {
		const spies = watchFetches();
		const { model, result, errors } = stream({});

		await result.consumeStream();

		expect(errors).toHaveLength(1);
		expect((errors[0] as Error).message).toBe(DOWNLOAD_REFUSED_MESSAGE);
		expect(model.doStreamCalls).toHaveLength(0);
		for (const spy of spies) {
			expect(spy).not.toHaveBeenCalled();
		}
	});

	it("hands the model URLs it takes directly, without a request", async () => {
		const spies = watchFetches();
		const { model, result, errors } = stream({
			"image/*": [HTTPS_URLS],
			"text/*": [HTTP_URLS],
		});

		await result.consumeStream();

		expect(errors).toHaveLength(0);
		expect(model.doStreamCalls).toHaveLength(1);
		for (const spy of spies) {
			expect(spy).not.toHaveBeenCalled();
		}
	});
});
