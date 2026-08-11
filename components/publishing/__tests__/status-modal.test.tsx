import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseInformation } from "@/hooks/use-case-information";
import { StatusModal } from "../status-modal";

vi.mock("@/hooks/use-case-information", () => ({
	useCaseInformation: vi.fn(),
}));

const mockedUseCaseInformation = vi.mocked(useCaseInformation);

const ADD_DESCRIPTION_PATTERN = /Add Description/;
const ADD_AUTHORS_SECTOR_PATTERN = /Add Authors, Sector/;
const PUBLISH_BUTTON_PATTERN = /Publish/;
const UNPUBLISH_CONSEQUENCE_PATTERN = /Unpublishing removes the public record/;
const LINKED_CASE_STUDIES_PATTERN = /linked to 2 case studies/;

function stubCaseInformation(
	overrides: Partial<ReturnType<typeof useCaseInformation>>
) {
	mockedUseCaseInformation.mockReturnValue({
		information: null,
		loading: false,
		saving: false,
		uploadingImage: false,
		save: vi.fn().mockResolvedValue(true),
		uploadFeatureImage: vi.fn().mockResolvedValue(true),
		removeFeatureImage: vi.fn().mockResolvedValue(true),
		...overrides,
	});
}

describe("StatusModal — Draft (the Publish flow, ADR 0003 §2)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows a loading state while case information is still being fetched, never gating the dialog itself", () => {
		stubCaseInformation({ loading: true });

		render(
			<StatusModal
				caseId="case-1"
				onOpenChange={vi.fn()}
				open={true}
				status="DRAFT"
			/>
		);

		// The dialog is already visible/mounted; only the content inside is
		// still loading.
		expect(screen.getByText("Case Status: Draft")).toBeInTheDocument();
		expect(screen.getByTestId("publish-content-loading")).toBeInTheDocument();
	});

	it("surfaces exactly the missing fields and offers to complete case information, rather than a from-scratch questionnaire", async () => {
		stubCaseInformation({ information: null });
		const onRequestCaseInformation = vi.fn();
		const user = userEvent.setup();

		render(
			<StatusModal
				caseId="case-1"
				onOpenChange={vi.fn()}
				onRequestCaseInformation={onRequestCaseInformation}
				open={true}
				status="DRAFT"
			/>
		);

		expect(
			screen.getByTestId("publish-content-incomplete")
		).toBeInTheDocument();
		expect(screen.getByText(ADD_DESCRIPTION_PATTERN)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Publish" })
		).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Complete case information" })
		);
		expect(onRequestCaseInformation).toHaveBeenCalledWith("description");
	});

	it("offers a single-confirm Publish when case information is complete (description, authors AND sector)", async () => {
		stubCaseInformation({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});
		const onPublish = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		render(
			<StatusModal
				caseId="case-1"
				onOpenChange={vi.fn()}
				onPublish={onPublish}
				open={true}
				status="DRAFT"
			/>
		);

		expect(screen.getByTestId("publish-content-ready")).toBeInTheDocument();
		const publishButton = screen.getByRole("button", { name: "Publish" });
		await user.click(publishButton);
		expect(onPublish).toHaveBeenCalledTimes(1);
	});

	it("still shows the missing-fields gate, not Publish, when only description is present (three-field gate)", () => {
		stubCaseInformation({
			information: {
				description: "A worked example",
				authors: null,
				sector: null,
				featureImageUrl: null,
			},
		});

		render(
			<StatusModal
				caseId="case-1"
				onOpenChange={vi.fn()}
				onPublish={vi.fn()}
				open={true}
				status="DRAFT"
			/>
		);

		expect(
			screen.getByTestId("publish-content-incomplete")
		).toBeInTheDocument();
		expect(screen.getByText(ADD_AUTHORS_SECTOR_PATTERN)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Publish" })
		).not.toBeInTheDocument();
	});

	it("disables Publish while a publish is in flight", () => {
		stubCaseInformation({
			information: {
				description: "Ready",
				authors: "Ada Lovelace",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});

		render(
			<StatusModal
				caseId="case-1"
				onOpenChange={vi.fn()}
				onPublish={vi.fn()}
				open={true}
				publishLoading={true}
				status="DRAFT"
			/>
		);

		expect(
			screen.getByRole("button", { name: PUBLISH_BUTTON_PATTERN })
		).toBeDisabled();
	});
});

describe("StatusModal — Published (divergence + unpublish)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Complete case information by default — most tests in this describe
		// block are not about the completeness gate, so they shouldn't be
		// coupled to it. Tests exercising the gate itself override this.
		stubCaseInformation({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});
	});

	it("shows the Update Published action when there are unpublished changes and case information is complete", async () => {
		const onUpdatePublished = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		render(
			<StatusModal
				hasChanges={true}
				onOpenChange={vi.fn()}
				onUpdatePublished={onUpdatePublished}
				open={true}
				status="PUBLISHED"
			/>
		);

		const updateButton = screen.getByRole("button", {
			name: "Update Published",
		});
		await user.click(updateButton);
		expect(onUpdatePublished).toHaveBeenCalledTimes(1);
	});

	it("blocks republish and surfaces the missing-fields gate when case information is incomplete (lead adjudication, 2026-08-11)", async () => {
		stubCaseInformation({ information: null });
		const onUpdatePublished = vi.fn().mockResolvedValue(undefined);
		const onRequestCaseInformation = vi.fn();
		const user = userEvent.setup();

		render(
			<StatusModal
				hasChanges={true}
				onOpenChange={vi.fn()}
				onRequestCaseInformation={onRequestCaseInformation}
				onUpdatePublished={onUpdatePublished}
				open={true}
				status="PUBLISHED"
			/>
		);

		expect(
			screen.getByTestId("republish-content-incomplete")
		).toBeInTheDocument();
		expect(screen.getByText(ADD_DESCRIPTION_PATTERN)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Update Published" })
		).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Complete case information" })
		);
		expect(onRequestCaseInformation).toHaveBeenCalledWith("description");
		expect(onUpdatePublished).not.toHaveBeenCalled();
	});

	it("does not show the republish gate when there are no unpublished changes, even if case information is incomplete", () => {
		stubCaseInformation({ information: null });

		render(
			<StatusModal
				hasChanges={false}
				onOpenChange={vi.fn()}
				onUpdatePublished={vi.fn()}
				open={true}
				status="PUBLISHED"
			/>
		);

		expect(
			screen.queryByTestId("republish-content-incomplete")
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Update Published" })
		).not.toBeInTheDocument();
	});

	it("requires a plain-consequences confirm before unpublishing", async () => {
		const onUnpublish = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		render(
			<StatusModal
				onOpenChange={vi.fn()}
				onUnpublish={onUnpublish}
				open={true}
				status="PUBLISHED"
			/>
		);

		await user.click(screen.getByRole("button", { name: "Unpublish" }));

		// The consequence is stated in plain language before any request fires.
		expect(screen.getByTestId("unpublish-confirm")).toBeInTheDocument();
		expect(screen.getByText(UNPUBLISH_CONSEQUENCE_PATTERN)).toBeInTheDocument();
		expect(onUnpublish).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Yes, unpublish" }));
		expect(onUnpublish).toHaveBeenCalledTimes(1);
	});

	it("cancelling the unpublish confirm does not call onUnpublish", async () => {
		const onUnpublish = vi.fn();
		const user = userEvent.setup();

		render(
			<StatusModal
				onOpenChange={vi.fn()}
				onUnpublish={onUnpublish}
				open={true}
				status="PUBLISHED"
			/>
		);

		await user.click(screen.getByRole("button", { name: "Unpublish" }));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(screen.queryByTestId("unpublish-confirm")).not.toBeInTheDocument();
		expect(onUnpublish).not.toHaveBeenCalled();
	});

	it("hides Unpublish while the case is linked to case studies", () => {
		render(
			<StatusModal
				linkedCaseStudyCount={2}
				onOpenChange={vi.fn()}
				onUnpublish={vi.fn()}
				open={true}
				status="PUBLISHED"
			/>
		);

		expect(
			screen.queryByRole("button", { name: "Unpublish" })
		).not.toBeInTheDocument();
		expect(screen.getByText(LINKED_CASE_STUDIES_PATTERN)).toBeInTheDocument();
	});
});
