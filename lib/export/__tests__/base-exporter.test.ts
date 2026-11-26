import { describe, expect, it } from "vitest";
import { exporterRegistry } from "@/lib/export";
import { MarkdownExporter, PDFExporter, WordExporter } from "../exporters";

describe("exporter registry as the product uses it", () => {
	it.each([
		["markdown", MarkdownExporter],
		["pdf", PDFExporter],
		["docx", WordExporter],
	] as const)("returns the %s exporter for its format", (format, exporterClass) => {
		const exporter = exporterRegistry.get(format);

		expect(exporter).toBeInstanceOf(exporterClass);
		expect(exporter?.format).toBe(format);
	});
});
