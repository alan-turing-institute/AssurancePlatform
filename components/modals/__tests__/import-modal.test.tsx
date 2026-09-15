import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportModal } from "../import-modal";

/**
 * A successful import that also carries warnings must show the "Import
 * warnings" banner BEFORE the user ever navigates away — the old code
 * closed the modal and called `router.push` in the same tick it set
 * `warnings`, so the banner never painted (QA finding, 2026-09-15;
 * `use-case-import.test.ts` covers the underlying hook's deferred-
 * navigation behaviour). This test drives the component purely off
 * `useCaseImport`'s return shape, so it's independent of that hook's own
 * fetch/router plumbing.
 */
const mockOnClose = vi.fn();

vi.mock("@/hooks/modal-hooks", () => ({
	useImportModal: () => ({ isOpen: true, onClose: mockOnClose }),
}));

const mockContinueToCase = vi.fn();
const mockUseCaseImport = vi.fn();

vi.mock("../_import-modal/use-case-import", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../_import-modal/use-case-import")>();
	return {
		...actual,
		useCaseImport: (...args: unknown[]) => mockUseCaseImport(...args),
	};
});

function baseHookState(overrides: Record<string, unknown> = {}) {
	return {
		loading: false,
		error: "",
		warnings: [] as string[],
		pendingCaseId: null,
		continueToCase: mockContinueToCase,
		setError: vi.fn(),
		githubConnected: true,
		googleConnected: true,
		selectedDriveFile: null,
		setSelectedDriveFile: vi.fn(),
		importCase: vi.fn(),
		importFromGitHub: vi.fn(),
		importFromGoogleDrive: vi.fn(),
		...overrides,
	};
}

describe("ImportModal — warnings hold navigation open (QA finding, 2026-09-15)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows the warnings banner and a Continue to case action instead of the import form once a warnings-carrying import is pending", () => {
		mockUseCaseImport.mockReturnValue(
			baseHookState({
				warnings: ["A legacy defeater name was renumbered on import."],
				pendingCaseId: "case-1",
			})
		);

		render(<ImportModal />);

		expect(screen.getByText("Import warnings:")).toBeInTheDocument();
		expect(
			screen.getByText("A legacy defeater name was renumbered on import.")
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Continue to case" })
		).toBeInTheDocument();
		// The import form is replaced, not layered underneath, while a
		// warnings ack is pending.
		expect(screen.queryByText("JSON File")).not.toBeInTheDocument();
	});

	it("navigates on Continue to case, not before", async () => {
		const user = userEvent.setup();
		mockUseCaseImport.mockReturnValue(
			baseHookState({
				warnings: ["A warning."],
				pendingCaseId: "case-1",
			})
		);

		render(<ImportModal />);

		expect(mockContinueToCase).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "Continue to case" }));
		expect(mockContinueToCase).toHaveBeenCalled();
	});

	it("shows the ordinary import form when nothing is pending", () => {
		mockUseCaseImport.mockReturnValue(baseHookState());

		render(<ImportModal />);

		expect(screen.queryByText("Import warnings:")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Continue to case" })
		).not.toBeInTheDocument();
	});
});
