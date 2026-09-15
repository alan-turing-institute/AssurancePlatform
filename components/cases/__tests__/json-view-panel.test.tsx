import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import JsonViewPanel from "../json-view-panel";

const ROOT_ID = "11111111-1111-4111-8111-111111111111";

function sampleExport() {
	return {
		version: "1.0" as const,
		exportedAt: "2026-09-14T10:00:00.000Z",
		case: { name: "Test Case", description: "A case" },
		tree: {
			id: ROOT_ID,
			type: "GOAL" as const,
			name: "G1",
			description: "Root goal",
			inSandbox: false,
			children: [],
		},
	};
}

vi.mock("@/actions/export-case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/actions/export-case")>();
	return {
		...actual,
		exportCase: vi.fn(async () => ({ data: sampleExport() })),
	};
});

vi.mock("@/lib/case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/case")>();
	return {
		...actual,
		fetchAndRefreshCase: vi.fn(async () => null),
	};
});

function resetStore(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
	});
}

describe("JsonViewPanel — full-screen toggle", () => {
	beforeEach(() => {
		resetStore();
	});

	it("enters full screen via the toolbar button, and Esc exits without closing the panel", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<JsonViewPanel isOpen={true} onClose={onClose} />);

		const enterButton = await screen.findByRole("button", {
			name: "Enter full screen",
		});
		await user.click(enterButton);

		const exitButton = await screen.findByRole("button", {
			name: "Exit full screen",
		});
		expect(exitButton).toHaveAttribute("aria-pressed", "true");

		// Escape targeting an element inside the panel — matches the fix
		// (react-doctor/vincent round 1): the handler is scoped to the Sheet
		// content via onKeyDownCapture, not a document-level listener, so it
		// only sees events whose target is inside this panel.
		await user.keyboard("{Escape}");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Enter full screen" })
			).toHaveAttribute("aria-pressed", "false");
		});

		// The panel itself must still be open — Esc only left full screen.
		expect(onClose).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Enter full screen" })
		).toHaveFocus();
	});

	it("Esc closes the panel as before when not in full screen", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<JsonViewPanel isOpen={true} onClose={onClose} />);

		const enterButton = await screen.findByRole("button", {
			name: "Enter full screen",
		});
		enterButton.focus();

		await user.keyboard("{Escape}");

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});
});

describe("JsonViewPanel — wrap toggle (real CodeMirror effect)", () => {
	beforeEach(() => {
		resetStore();
	});

	it("adds and removes CodeMirror's own cm-lineWrapping class, not just the button state", async () => {
		const user = userEvent.setup();
		render(<JsonViewPanel isOpen={true} onClose={vi.fn()} />);

		const wrapButton = await screen.findByRole("button", {
			name: "Enable line wrap",
		});
		const content = document.querySelector(".cm-content");
		expect(content).not.toBeNull();
		expect(content).not.toHaveClass("cm-lineWrapping");

		await user.click(wrapButton);

		await waitFor(() => {
			expect(document.querySelector(".cm-content")).toHaveClass(
				"cm-lineWrapping"
			);
		});

		await user.click(screen.getByRole("button", { name: "Disable line wrap" }));

		await waitFor(() => {
			expect(document.querySelector(".cm-content")).not.toHaveClass(
				"cm-lineWrapping"
			);
		});
	});
});

describe("JsonViewPanel — Format button (real content effect)", () => {
	beforeEach(() => {
		resetStore();
	});

	it("re-indents a minified buffer to 2-space JSON", async () => {
		const user = userEvent.setup();
		render(<JsonViewPanel isOpen={true} onClose={vi.fn()} />);

		const content = await waitFor(() => {
			const el = document.querySelector(".cm-content");
			expect(el).not.toBeNull();
			expect(el?.textContent).toContain("Root goal");
			return el as HTMLElement;
		});

		await user.click(content);
		await user.keyboard("{Control>}a{/Control}");
		const minified = JSON.stringify(sampleExport());
		// Paste, not keyboard() — the JSON text is full of `{`/`}`, which
		// user-event's keyboard() parses as its own key-description syntax.
		await user.paste(minified);

		await waitFor(() => {
			expect(docText(content)).toBe(minified);
		});
		// Confirms the buffer really is on one line before Format runs.
		expect(docLines(content)).toHaveLength(1);

		const formatButton = screen.getByRole("button", { name: "Format JSON" });
		expect(formatButton).toBeEnabled();
		await user.click(formatButton);

		await waitFor(() => {
			expect(docLines(content).length).toBeGreaterThan(1);
		});
		expect(docText(content)).toBe(JSON.stringify(sampleExport(), null, 2));
	});
});

/**
 * jsdom doesn't implement `Range.getClientRects()`, so CodeMirror's
 * fallback text-metrics measurement (a temporary `.cm-line` dummy it
 * appends to measure char width — see `measureTextSize` in
 * `@codemirror/view`) throws before it can remove that dummy, leaking an
 * absolutely-positioned "abc def ghi jkl mno pqr stu" line into the DOM.
 * This filters it out so assertions read the real document only.
 */
function docLines(content: HTMLElement): HTMLElement[] {
	return Array.from(content.querySelectorAll<HTMLElement>(".cm-line")).filter(
		(line) => line.style.position !== "absolute"
	);
}

function docText(content: HTMLElement): string {
	return docLines(content)
		.map((line) => line.textContent ?? "")
		.join("\n");
}
