import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { IntegrationTokenSecretModal } from "../integration-token-secret-modal";

const SECRET = "tea_live_ab12cd34ef56";
const SHOWN_ONCE_WARNING_REGEX = /only time this token is displayed/i;
const COPY_BUTTON_REGEX = /copy token/i;
const COPIED_BUTTON_REGEX = /copied/i;
const DONE_BUTTON_REGEX = /done.*stored it/i;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("IntegrationTokenSecretModal", () => {
	it("renders nothing when reveal is null", () => {
		renderWithoutProviders(
			<IntegrationTokenSecretModal onClose={vi.fn()} reveal={null} />
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("renders the plaintext secret from the reveal prop, plus the shown-once warning", () => {
		renderWithoutProviders(
			<IntegrationTokenSecretModal
				onClose={vi.fn()}
				reveal={{ secret: SECRET }}
			/>
		);

		expect(screen.getByTestId("token-secret-value")).toHaveTextContent(SECRET);
		expect(screen.getByText(SHOWN_ONCE_WARNING_REGEX)).toBeInTheDocument();
	});

	it("renders an optional notice (e.g. a rotation's overlap window)", () => {
		renderWithoutProviders(
			<IntegrationTokenSecretModal
				onClose={vi.fn()}
				reveal={{
					secret: SECRET,
					notice: "The previous token stays valid until 14:32.",
				}}
			/>
		);

		expect(
			screen.getByText("The previous token stays valid until 14:32.")
		).toBeInTheDocument();
	});

	it("copies the secret to the clipboard and shows a Copied confirmation", async () => {
		// `userEvent.setup()` unconditionally installs its OWN
		// `navigator.clipboard` stub (`attachClipboardStubToView`, called
		// directly from its `setup()`), overwriting anything already there —
		// so the override below has to happen AFTER `setup()`, not before, or
		// `setup()` clobbers it. That stub is otherwise a good citizen (Real
		// EventTarget-backed Clipboard implementation used by `user.copy()`/
		// `user.paste()`), so we still redefine only `writeText` for this
		// assertion, not the whole clipboard object.
		const user = userEvent.setup();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});

		renderWithoutProviders(
			<IntegrationTokenSecretModal
				onClose={vi.fn()}
				reveal={{ secret: SECRET }}
			/>
		);

		await user.click(screen.getByRole("button", { name: COPY_BUTTON_REGEX }));

		expect(writeText).toHaveBeenCalledWith(SECRET);
		expect(
			await screen.findByRole("button", { name: COPIED_BUTTON_REGEX })
		).toBeInTheDocument();
	});

	it("calls onClose when Done is clicked", async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<IntegrationTokenSecretModal
				onClose={onClose}
				reveal={{ secret: SECRET }}
			/>
		);

		await user.click(screen.getByRole("button", { name: DONE_BUTTON_REGEX }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("no longer renders the secret once the caller clears reveal to null — the only place the secret lives is this prop", () => {
		const { rerender } = renderWithoutProviders(
			<IntegrationTokenSecretModal
				onClose={vi.fn()}
				reveal={{ secret: SECRET }}
			/>
		);

		expect(screen.getByTestId("token-secret-value")).toHaveTextContent(SECRET);

		// Simulates the parent's tokenReveal state being cleared on close —
		// exactly what `IntegrationCard`'s onClose handler does.
		rerender(<IntegrationTokenSecretModal onClose={vi.fn()} reveal={null} />);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
	});
});
