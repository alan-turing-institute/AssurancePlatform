import { streamText } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { noDownload } from "@/lib/plugins/assistant/no-download";
import {
	type CountingServer,
	releaseMockedNetwork,
	sleep,
	startServer,
} from "@/src/__tests__/utils/model-adversarial-kit";

const ANY_HTTP = /^http:\/\/.*$/;

const USAGE = {
	inputTokens: {
		total: 1,
		noCache: 1,
		cacheRead: undefined,
		cacheWrite: undefined,
	},
	outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function textStream() {
	return {
		stream: simulateReadableStream({
			chunks: [
				{ type: "stream-start" as const, warnings: [] },
				{ type: "text-start" as const, id: "t" },
				{ type: "text-delta" as const, id: "t", delta: "ok" },
				{ type: "text-end" as const, id: "t" },
				{
					type: "finish" as const,
					finishReason: { unified: "stop" as const, raw: undefined },
					usage: USAGE,
				},
			],
		}),
	};
}

let target: CountingServer | undefined;

beforeAll(releaseMockedNetwork);

afterEach(async () => {
	await target?.close();
	target = undefined;
});

async function reply(
	url: string,
	supportedUrls: Record<string, RegExp[]> = {}
) {
	const model = new MockLanguageModelV3({
		supportedUrls,
		doStream: [textStream()],
	});
	const errors: unknown[] = [];
	const result = streamText({
		model,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: "what is in this?" },
					{ type: "file", data: new URL(url), mediaType: "image/png" },
				],
			},
		],
		experimental_download: noDownload,
		maxRetries: 0,
		onError: ({ error }) => {
			errors.push(error);
		},
	});
	await result.consumeStream();
	return { model, errors };
}

describe("the assistant never downloads a URL for the model", () => {
	it("fetches nothing from a local server, and never calls the model, when the model cannot take the URL itself", async () => {
		target = await startServer();
		const { model, errors } = await reply(`${target.origin}/secret.png`);
		await sleep(50);
		expect(target.connections).toBe(0);
		expect(target.hits).toHaveLength(0);
		expect(model.doStreamCalls).toHaveLength(0);
		expect(errors).toHaveLength(1);
		expect(String(errors[0])).not.toContain("secret.png");
		expect(String(errors[0])).not.toContain(String(target.port));
	});

	it.each([
		"http://169.254.169.254/latest/meta-data/",
		"http://168.63.129.16/machine",
		"https://127.0.0.1/x.png",
		"http://[::1]/x.png",
		"http://example.org/x.png",
		"ftp://example.org/x.png",
	])("refuses %s without fetching it", async (url) => {
		const { model, errors } = await reply(url);
		expect(model.doStreamCalls).toHaveLength(0);
		expect(errors).toHaveLength(1);
		expect(String(errors[0])).not.toContain("example.org");
		expect(String(errors[0])).not.toContain("169.254");
	});

	it("passes a URL the model can take itself on to the model without fetching it", async () => {
		target = await startServer();
		const url = `${target.origin}/picture.png`;
		const { model, errors } = await reply(url, {
			"image/*": [ANY_HTTP],
		});
		await sleep(50);
		expect(errors).toHaveLength(0);
		expect(target.connections).toBe(0);
		expect(model.doStreamCalls).toHaveLength(1);
	});

	it("never fetches, whatever the list of requests holds", async () => {
		target = await startServer();
		const url = new URL(`${target.origin}/x`);
		await expect(
			noDownload([
				{ url, isUrlSupportedByModel: false },
				{ url, isUrlSupportedByModel: true },
			])
		).rejects.toThrow();
		await expect(
			noDownload([{ url, isUrlSupportedByModel: true }])
		).resolves.toEqual([null]);
		await sleep(50);
		expect(target.connections).toBe(0);
	});
});
