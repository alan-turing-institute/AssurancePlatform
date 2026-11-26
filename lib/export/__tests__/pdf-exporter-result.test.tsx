import { describe, expect, it, vi } from "vitest";
import { exportDocument } from "@/src/__tests__/utils/export-document-kit";
import { PDFExporter } from "../exporters/pdf-exporter";

vi.mock("@react-pdf/renderer", async () => ({
	...(await import("@/src/__tests__/utils/export-pdf-kit")).pdfStandIn,
	pdf: () => ({
		toBlob: () => Promise.reject("not an error object"),
	}),
}));

describe("PDFExporter failure result", () => {
	it("returns a failure with a generic reason when something other than an error is thrown", async () => {
		const result = await new PDFExporter().export(exportDocument(), {
			caseName: "Case",
		});

		expect(result).toStrictEqual({
			success: false,
			error: "PDF export failed: Unknown error occurred",
		});
	});
});
