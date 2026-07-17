import { beforeEach, describe, expect, it } from "vitest";
import useStore from "../store";

/**
 * The case-information sheet has two entry points — the title-click
 * (`Header`) and the toolbar's "Case Information" button (`ActionButtons`)
 * — that live in different parts of the component tree from where the
 * sheet itself (`CaseDetails`) is rendered (`CaseContainer`). This one
 * store flag is what connects them (same pattern as `commentsSheetOpen`),
 * so it is worth pinning directly rather than only through each caller.
 */
describe("useStore — caseDetailsOpen", () => {
	beforeEach(() => {
		useStore.setState({ caseDetailsOpen: false });
	});

	it("defaults to closed", () => {
		expect(useStore.getState().caseDetailsOpen).toBe(false);
	});

	it("opens via setCaseDetailsOpen(true)", () => {
		useStore.getState().setCaseDetailsOpen(true);
		expect(useStore.getState().caseDetailsOpen).toBe(true);
	});

	it("closes via setCaseDetailsOpen(false)", () => {
		useStore.getState().setCaseDetailsOpen(true);
		useStore.getState().setCaseDetailsOpen(false);
		expect(useStore.getState().caseDetailsOpen).toBe(false);
	});
});
