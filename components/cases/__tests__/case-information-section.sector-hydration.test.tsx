import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Real Radix Select, not the suite-wide mock (`src/__tests__/mocks/radix-ui-mocks.tsx`).
// The bug this file guards against is specific to Radix's actual `Select` root: it
// mirrors its controlled `value` onto a hidden native `<select>` for native form
// semantics (`SelectBubbleInput`), and re-syncs that mirror by dispatching a native
// "change" event whenever the controlled value prop changes — including the mount-time
// change from empty to a hydrated value. The mock does not model that mirror, so it
// cannot reproduce (or regress-guard) this failure mode; only the real Radix
// implementation can.
vi.unmock("@radix-ui/react-select");

const { useCaseInformation } = await import("@/hooks/use-case-information");
const { CaseInformationSection } = await import("../case-information-section");

vi.mock("@/hooks/use-case-information", () => ({
	useCaseInformation: vi.fn(),
}));

const mockedUseCaseInformation = vi.mocked(useCaseInformation);
const FINANCIAL_SERVICES_PATTERN = /financial services/i;
const LEGACY_MEDICAL_DEVICES_PATTERN = /medical devices \(legacy value\)/i;

function stubHook(overrides: Partial<ReturnType<typeof useCaseInformation>>) {
	mockedUseCaseInformation.mockReturnValue({
		forCaseId: "case-1",
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

describe("CaseInformationSection sector hydration (real Radix Select)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows a saved canonical sector on the closed trigger without any interaction", async () => {
		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Financial Services",
				featureImageUrl: null,
			},
		});

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);
		await screen.findByTestId("case-information-form");

		await waitFor(() => {
			expect(screen.getByRole("combobox")).toHaveTextContent(
				FINANCIAL_SERVICES_PATTERN
			);
		});
	});

	it("shows a saved legacy free-text sector, tagged '(legacy value)', on the closed trigger without any interaction", async () => {
		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Medical Devices",
				featureImageUrl: null,
			},
		});

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);
		await screen.findByTestId("case-information-form");

		await waitFor(() => {
			expect(screen.getByRole("combobox")).toHaveTextContent(
				LEGACY_MEDICAL_DEVICES_PATTERN
			);
		});
	});
});
