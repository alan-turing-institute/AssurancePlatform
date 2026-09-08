import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { useAutoScreenshot } from "../use-auto-screenshot";

vi.mock("html2canvas", () => ({
	default: vi.fn(),
}));

import html2canvas from "html2canvas";

const CASE_ID = "case-1";
const TARGET_SELECTOR = "#screenshot-target";

function capture(): LogEntry[] {
	const entries: LogEntry[] = [];
	setLogSink((entry) => {
		entries.push(entry);
	});
	return entries;
}

describe("useAutoScreenshot — capture failure handling", () => {
	let target: HTMLDivElement;
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		target = document.createElement("div");
		target.id = "screenshot-target";
		document.body.appendChild(target);
		vi.stubEnv("LOG_LEVEL", "debug");
		fetchSpy = vi.spyOn(global, "fetch");
	});

	afterEach(() => {
		target.remove();
		resetLogSink();
		vi.unstubAllEnvs();
		vi.mocked(html2canvas).mockReset();
		fetchSpy.mockRestore();
	});

	it("logs an error carrying the caseId when html2canvas throws, and never uploads", async () => {
		vi.mocked(html2canvas).mockRejectedValue(
			new Error('Attempting to parse an unsupported color function "oklch"')
		);
		const entries = capture();

		const { result } = renderHook(() =>
			useAutoScreenshot({
				caseId: CASE_ID,
				canEdit: true,
				selector: TARGET_SELECTOR,
			})
		);

		await result.current.captureScreenshot();

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(entries).toContainEqual(
			expect.objectContaining({
				level: "error",
				msg: "Screenshot capture failed",
				caseId: CASE_ID,
			})
		);
	});

	it("skips the upload and logs a warning when html2canvas returns a degenerate capture", async () => {
		vi.mocked(html2canvas).mockResolvedValue({
			toDataURL: () => "",
		} as unknown as HTMLCanvasElement);
		const entries = capture();

		const { result } = renderHook(() =>
			useAutoScreenshot({
				caseId: CASE_ID,
				canEdit: true,
				selector: TARGET_SELECTOR,
			})
		);

		await result.current.captureScreenshot();

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(entries).toContainEqual(
			expect.objectContaining({
				level: "warn",
				msg: "Skipped upload of a degenerate screenshot capture",
				caseId: CASE_ID,
			})
		);
	});
});
