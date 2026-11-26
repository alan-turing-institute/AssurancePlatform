import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import {
	fetchAndRefreshCase,
	refreshCaseIfShown,
} from "../fetch-and-refresh-case";

const entries: LogEntry[] = [];

beforeEach(() => {
	entries.length = 0;
	vi.stubEnv("LOG_LEVEL", "debug");
	setLogSink((entry) => {
		entries.push(entry);
	});
});

afterEach(() => {
	resetLogSink();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function stubReply(body: unknown, status: number) {
	const fetchMock = vi.fn((_url: string) =>
		Promise.resolve(new Response(JSON.stringify(body), { status }))
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const serverCase = { id: "case-1", goals: [{ id: "g1" }] };

describe("fetchAndRefreshCase", () => {
	it("reads the case from its address and marks every node shown", async () => {
		const fetchMock = stubReply(serverCase, 200);
		const result = await fetchAndRefreshCase("case-1");
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cases/case-1");
		expect(result).toStrictEqual({
			id: "case-1",
			hidden: false,
			goals: [{ id: "g1", hidden: false }],
		});
	});

	it("gives null when the server refuses", async () => {
		stubReply({ id: "case-1", error: "Not found" }, 404);
		expect(await fetchAndRefreshCase("case-1")).toBeNull();
	});
});

describe("refreshCaseIfShown", () => {
	function refresh(shown: string | undefined) {
		const apply = vi.fn<(fresh: AssuranceCaseResponse) => void>();
		refreshCaseIfShown("case-1", () => shown, apply);
		return apply;
	}

	it("hands the fresh case on while that case is shown", async () => {
		stubReply(serverCase, 200);
		const apply = refresh("case-1");
		await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
		expect(apply.mock.calls[0]?.[0]).toHaveProperty("id", "case-1");
	});

	it("drops the reply when another case is shown", async () => {
		const fetchMock = stubReply(serverCase, 200);
		const apply = refresh("case-2");
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(apply).not.toHaveBeenCalled();
	});

	it("applies nothing when the read is refused", async () => {
		const fetchMock = stubReply({}, 500);
		const apply = refresh("case-1");
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(apply).not.toHaveBeenCalled();
		expect(entries).toHaveLength(0);
	});

	it("logs a warning, and applies nothing, when the read fails", async () => {
		const failure = new Error("offline");
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(failure))
		);
		const apply = refresh("case-1");
		await vi.waitFor(() => expect(entries).toHaveLength(1));
		const [entry] = entries;
		expect(entry?.level).toBe("warn");
		expect(entry?.msg).toBe("Failed to read the case again after a change");
		expect(entry?.component).toBe("fetch-and-refresh-case");
		expect(entry?.error).toBeDefined();
		expect(apply).not.toHaveBeenCalled();
	});
});
