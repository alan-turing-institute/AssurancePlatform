import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
	userEvent,
} from "@/src/__tests__/utils/test-utils";
import { DocumentExportSection } from "../document-export-section";

vi.mock("@/actions/export-document", () => ({
	getDocumentExportData: vi.fn(),
}));

vi.mock("@/lib/case/document-export", () => ({
	BRANCH_DIAGRAM_THRESHOLD: 50,
	exportDocument: vi.fn(),
}));

const ZIP_NOTE = /downloads as a \.zip file/;

function renderSection() {
	return renderWithoutProviders(
		<DocumentExportSection
			assuranceCase={null}
			edges={[]}
			layoutDirection="TB"
			nodes={[]}
			setEdges={vi.fn()}
			setLayoutDirection={vi.fn()}
			setNodes={vi.fn()}
			toast={vi.fn()}
		/>
	);
}

describe("DocumentExportSection zip note", () => {
	it("is shown for Markdown with the Diagram section on", async () => {
		const user = userEvent.setup();
		renderSection();

		await user.click(screen.getByLabelText("Markdown"));

		expect(screen.getByText(ZIP_NOTE)).toBeInTheDocument();
	});

	it("is not shown for PDF or Word", async () => {
		const user = userEvent.setup();
		renderSection();

		expect(screen.queryByText(ZIP_NOTE)).not.toBeInTheDocument();
		await user.click(screen.getByLabelText("Word"));
		expect(screen.getByRole("radio", { name: "Word" })).toBeChecked();
		expect(screen.queryByText(ZIP_NOTE)).not.toBeInTheDocument();
	});

	it("is not shown for Markdown once Diagram is unticked", async () => {
		const user = userEvent.setup();
		renderSection();

		await user.click(screen.getByLabelText("Markdown"));
		expect(screen.getByText(ZIP_NOTE)).toBeInTheDocument();
		await user.click(screen.getByText("Customise sections"));
		await user.click(screen.getByLabelText("Diagram"));

		expect(screen.queryByText(ZIP_NOTE)).not.toBeInTheDocument();
	});
});
