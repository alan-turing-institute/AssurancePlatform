import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { RequestJsonError, requestJson } from "../request-json";

const PATH = "/api/__test__/request-json";

describe("requestJson", () => {
	it("resolves with the parsed JSON body on a 2xx response", async () => {
		server.use(
			http.get(PATH, () => HttpResponse.json({ ok: true, value: 42 }))
		);

		const body = await requestJson<{ ok: boolean; value: number }>(PATH);

		expect(body).toEqual({ ok: true, value: 42 });
	});

	it("always sends Content-Type: application/json, merged with any caller-supplied headers", async () => {
		let seenContentType: string | null = null;
		let seenCustomHeader: string | null = null;
		server.use(
			http.post(PATH, ({ request }) => {
				seenContentType = request.headers.get("Content-Type");
				seenCustomHeader = request.headers.get("X-Custom");
				return HttpResponse.json({ ok: true });
			})
		);

		await requestJson(PATH, {
			method: "POST",
			headers: { "X-Custom": "value" },
			body: JSON.stringify({}),
		});

		expect(seenContentType).toBe("application/json");
		expect(seenCustomHeader).toBe("value");
	});

	it("throws a RequestJsonError carrying the envelope's message and the status code on a non-2xx response", async () => {
		server.use(
			http.get(PATH, () =>
				HttpResponse.json({ error: "Case not found" }, { status: 404 })
			)
		);

		await expect(requestJson(PATH)).rejects.toMatchObject({
			name: "RequestJsonError",
			message: "Case not found",
			status: 404,
		});
		await expect(requestJson(PATH)).rejects.toBeInstanceOf(RequestJsonError);
	});

	it("falls back to a generic message when the failure body isn't JSON or has no `error` field", async () => {
		server.use(
			http.get(PATH, () => new HttpResponse("<html/>", { status: 500 }))
		);

		await expect(requestJson(PATH)).rejects.toMatchObject({
			message: "Something went wrong",
			status: 500,
		});
	});
});
