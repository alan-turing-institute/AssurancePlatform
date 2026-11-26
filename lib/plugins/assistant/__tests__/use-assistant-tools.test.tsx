import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useAssistantTools } from "@/lib/plugins/assistant/use-assistant-tools";
import { server } from "@/src/__tests__/mocks/server";

const urlFor = (caseId: string) => `/api/cases/${caseId}/assistant`;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useAssistantTools", () => {
	it("gives null while the request runs, then the names of the tools", async () => {
		server.use(
			http.get(urlFor("case-1"), () =>
				HttpResponse.json({ tools: ["read_case", "lint_case"] })
			)
		);

		const { result } = renderHook(() => useAssistantTools("case-1"));

		expect(result.current).toBeNull();
		await waitFor(() =>
			expect(result.current).toStrictEqual(["read_case", "lint_case"])
		);
	});

	it("keeps only the names that are text", async () => {
		server.use(
			http.get(urlFor("case-1"), () =>
				HttpResponse.json({ tools: ["read_case", 3, null, "lint_case", {}] })
			)
		);

		const { result } = renderHook(() => useAssistantTools("case-1"));

		await waitFor(() => expect(result.current).not.toBeNull());
		expect(result.current).toStrictEqual(["read_case", "lint_case"]);
	});

	it.each([
		["no tools field", {}],
		["a tools field that is not a list", { tools: "read_case" }],
	])("gives an empty list when the answer has %s", async (_label, body) => {
		server.use(http.get(urlFor("case-1"), () => HttpResponse.json(body)));

		const { result } = renderHook(() => useAssistantTools("case-1"));

		await waitFor(() => expect(result.current).not.toBeNull());
		expect(result.current).toStrictEqual([]);
	});

	it("stays null when the request is refused", async () => {
		let answered: () => void = () => undefined;
		const refusal = new Promise<void>((resolve) => {
			answered = resolve;
		});
		const original = globalThis.fetch;
		vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
			const response = await original(...args);
			answered();
			return response;
		});
		server.use(
			http.get(urlFor("case-1"), () =>
				HttpResponse.json({ error: "Forbidden" }, { status: 403 })
			)
		);

		const { result } = renderHook(() => useAssistantTools("case-1"));
		await act(async () => {
			await refusal;
		});
		await act(async () => undefined);

		expect(result.current).toBeNull();
	});

	it("asks again for the new case when the case changes", async () => {
		server.use(
			http.get(urlFor("case-1"), () => HttpResponse.json({ tools: ["one"] })),
			http.get(urlFor("case-2"), () => HttpResponse.json({ tools: ["two"] }))
		);

		const { result, rerender } = renderHook(
			({ caseId }) => useAssistantTools(caseId),
			{ initialProps: { caseId: "case-1" } }
		);
		await waitFor(() => expect(result.current).toStrictEqual(["one"]));

		rerender({ caseId: "case-2" });

		await waitFor(() => expect(result.current).toStrictEqual(["two"]));
	});
});
