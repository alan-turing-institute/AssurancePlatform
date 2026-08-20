import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

	// Deliberately the FIRST test in this file, as belt-and-braces — but this
	// is not load-bearing. The warning this assertion captures comes from
	// Radix's `@radix-ui/react-use-controllable-state` hook (see its
	// `console.warn` call, caller "Select"), which tracks "was controlled" in
	// a fresh `React.useRef` per component instance and carries no
	// module-scoped dedup state; it fires on every mount that flips
	// controlled/uncontrolled, regardless of what earlier tests in this file
	// triggered. (React DOM does have a module-scoped deduped version of this
	// warning — `didWarnUncontrolledToControlled` — but that guards native
	// elements directly, not this Radix-wrapped one.) Verified empirically by
	// moving this test to second position in the file: it still fails
	// correctly on a regression.
	it("never switches the Select between controlled and uncontrolled across the loading-to-hydrated transition", async () => {
		// Real-browser evidence (2026-08-19) showed the actual failure mode
		// wasn't the phantom-clear onValueChange this suite otherwise guards —
		// it was the Select's `value` prop itself flipping between `undefined`
		// (while loading, pre-hydration) and a string (post-hydration), which
		// React treats as a controlled/uncontrolled switch and can silently
		// drop. jsdom doesn't reproduce the drop (Radix's hidden native
		// `<select>` mirror timing differs from a real browser's), but it DOES
		// reproduce the warning React logs for the switch itself — so assert
		// on that directly, synchronously. React logs this one via
		// `console.error` for a native `<select>`, but Chromium categorises
		// the equivalent as `console.warn` — spy on both so this doesn't
		// depend on that implementation detail.
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const consoleWarn = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);

		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				// Stored value is the stable ID (10 = "Financial Services" in
				// lib/sectors.ts), not the display name.
				sector: "10",
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

		const isControlledSwitchWarning = (call: unknown[]) =>
			String(call[0]).includes("is changing from uncontrolled to controlled") ||
			String(call[0]).includes("is changing from controlled to uncontrolled");
		const controlledSwitchWarnings = [
			...consoleError.mock.calls,
			...consoleWarn.mock.calls,
		].filter(isControlledSwitchWarning);
		expect(controlledSwitchWarnings).toHaveLength(0);

		consoleError.mockRestore();
		consoleWarn.mockRestore();
	});

	it("shows a saved canonical sector on the closed trigger without any interaction", async () => {
		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				// Stable ID, not the display name — see the note above.
				sector: "10",
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

	it("propagates a genuine user selection to the form value and the closed trigger", async () => {
		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "",
				featureImageUrl: null,
			},
		});
		const user = userEvent.setup();

		render(<CaseInformationSection canEdit={true} caseId="case-1" />);
		await screen.findByTestId("case-information-form");

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);
		await user.click(
			await screen.findByRole("option", { name: FINANCIAL_SERVICES_PATTERN })
		);

		// This is the assertion the fix's premise rests on: a real user
		// selection (a genuine `onValueChange` call carrying a non-empty
		// value) must still reach `field.onChange` and update the trigger.
		// The empty-string guard added for the phantom-hydration bug only
		// filters `nextValue === ""` — it must never suppress this path.
		await waitFor(() => {
			expect(trigger).toHaveTextContent(FINANCIAL_SERVICES_PATTERN);
		});
	});

	it("never clears an already-hydrated value on a phantom empty onValueChange (no clear affordance exists in this list)", async () => {
		stubHook({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "10",
				featureImageUrl: null,
			},
		});

		const { container } = render(
			<CaseInformationSection canEdit={true} caseId="case-1" />
		);
		await screen.findByTestId("case-information-form");

		const trigger = screen.getByRole("combobox");
		await waitFor(() => {
			expect(trigger).toHaveTextContent(FINANCIAL_SERVICES_PATTERN);
		});

		// Reproduce the phantom event directly, rather than relying on mount
		// timing: Radix's hidden `SelectBubbleInput` mirrors the controlled
		// value onto a real native `<select aria-hidden>` and wires its
		// `onChange` straight to `context.onValueChange` (see
		// @radix-ui/react-select's `Select` — `onChange: (event) =>
		// setValue(event.target.value)`). Firing a native "change" with an
		// empty value on that element is exactly the event our guard exists
		// to ignore.
		const nativeSelect = container.querySelector('select[aria-hidden="true"]');
		expect(nativeSelect).not.toBeNull();
		if (nativeSelect) {
			fireEvent.change(nativeSelect, { target: { value: "" } });
		}

		// The guard in case-information-section.tsx's `onValueChange` treats
		// any empty-string callback as the phantom mount-time sync described
		// above and ignores it, because no `SelectItem value=""` exists in
		// this list — there is no "clear sector" affordance a user could have
		// triggered instead. If a Clear control is ever added, it will need
		// its own non-empty sentinel (not "") or this guard will silently eat
		// its event too — see the comment at that guard.
		expect(trigger).toHaveTextContent(FINANCIAL_SERVICES_PATTERN);
	});
});
