import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShowUnsupportedMarkers } from "@/actions/unsupported-markers";
import { useCaseEvents } from "@/hooks/use-case-events";
import { fetchAndRefreshCase } from "@/lib/case";
import { toastInfo } from "@/lib/toast";
import useStore from "@/store/store";
import CaseContainer from "../case-container";
import { CaseKindMenu } from "../case-kind-menu";
import { PatternBanner } from "../pattern-banner";

/**
 * What an editor that is already open does when someone else converts the
 * case: it reads the case again, so the pattern notice and the convert menu
 * follow the new kind without a page reload.
 */

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/actions/case-kind", () => ({
	convertCaseKind: vi.fn(),
	fetchConversionConsequences: vi.fn(),
}));
vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	useCaseEvents: vi.fn(),
}));
vi.mock("@/lib/case", () => ({
	addHiddenProp: (value: unknown) => value,
	fetchAndRefreshCase: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
	toast: vi.fn(),
	toastError: vi.fn(),
	toastInfo: vi.fn(),
	toastSuccess: vi.fn(),
}));
vi.mock("@/components/tour/check-tour", () => ({ default: () => null }));
vi.mock("../flow", () => ({
	default: () => (
		<div data-testid="flow">
			<PatternBanner />
			<CaseKindMenu />
		</div>
	),
}));
vi.mock("../header", () => ({ default: () => null }));
vi.mock("../case-details", () => ({ default: () => null }));

// The signed-in user in the shared next-auth mock has the id "1".
const SELF = "1";
const CASE_ID = "00000000-0000-4000-8000-0000000000c1";

function caseOfKind(kind: "CASE" | "PATTERN") {
	return {
		id: CASE_ID,
		name: "Case",
		kind,
		goals: [],
		permissions: "manage",
	};
}

beforeEach(() => {
	vi.mocked(toastInfo).mockReset();
	vi.mocked(fetchAndRefreshCase).mockReset();
	vi.mocked(useCaseEvents).mockReset();
	vi.mocked(fetchShowUnsupportedMarkers).mockResolvedValue(true);
	useStore.setState({ assuranceCase: null });
});

/** Opens the editor on a case of `kind` and returns the way to send it events. */
async function openEditor(kind: "CASE" | "PATTERN") {
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) =>
			Promise.resolve(
				Response.json(url.endsWith("/sandbox") ? [] : caseOfKind(kind))
			)
		)
	);
	render(<CaseContainer caseId={CASE_ID} />);
	await screen.findByTestId("flow");
	await waitFor(() => {
		expect(useStore.getState().assuranceCase?.kind).toBe(kind);
	});
	return (payload: Record<string, unknown>) => {
		const onEvent = vi.mocked(useCaseEvents).mock.calls.at(-1)?.[0].onEvent;
		act(() => {
			onEvent?.({
				type: "case:updated",
				caseId: CASE_ID,
				payload,
				timestamp: "now",
				userId: payload.userId,
			} as never);
		});
	};
}

async function menuItemName() {
	const user = userEvent.setup();
	await user.click(screen.getByTestId("toolbar-more-actions"));
	return (await screen.findByTestId("convert-case-kind")).textContent;
}

describe("an open editor when another person converts the case", () => {
	it("shows the pattern notice and offers the way back once a case becomes a pattern", async () => {
		const send = await openEditor("CASE");
		expect(screen.queryByTestId("pattern-banner")).not.toBeInTheDocument();
		vi.mocked(fetchAndRefreshCase).mockResolvedValue(
			caseOfKind("PATTERN") as never
		);

		send({
			action: "kind-changed",
			kind: "PATTERN",
			userId: "2",
			username: "alice",
		});

		expect(await screen.findByTestId("pattern-banner")).toBeInTheDocument();
		expect(fetchAndRefreshCase).toHaveBeenCalledWith(CASE_ID);
		expect(useStore.getState().assuranceCase?.kind).toBe("PATTERN");
		expect(await menuItemName()).toContain("Convert to case");
		expect(toastInfo).toHaveBeenCalledWith(
			"alice converted this case to a pattern",
			{ duration: 4000 }
		);
	});

	it("drops the pattern notice and offers to convert again once a pattern becomes a case", async () => {
		const send = await openEditor("PATTERN");
		expect(screen.getByTestId("pattern-banner")).toBeInTheDocument();
		vi.mocked(fetchAndRefreshCase).mockResolvedValue(
			caseOfKind("CASE") as never
		);

		send({
			action: "kind-changed",
			kind: "CASE",
			userId: "2",
			username: "alice",
		});

		await waitFor(() => {
			expect(screen.queryByTestId("pattern-banner")).not.toBeInTheDocument();
		});
		expect(useStore.getState().assuranceCase?.kind).toBe("CASE");
		expect(await menuItemName()).toContain("Convert to pattern");
	});

	it("reads the case again for the converting person's own second window, without a toast", async () => {
		const send = await openEditor("CASE");
		vi.mocked(fetchAndRefreshCase).mockResolvedValue(
			caseOfKind("PATTERN") as never
		);

		send({
			action: "kind-changed",
			kind: "PATTERN",
			userId: SELF,
			username: "me",
		});

		expect(await screen.findByTestId("pattern-banner")).toBeInTheDocument();
		expect(toastInfo).not.toHaveBeenCalled();
	});

	it("keeps what is on screen when the case cannot be read again", async () => {
		const send = await openEditor("CASE");
		vi.mocked(fetchAndRefreshCase).mockResolvedValue(null);

		send({
			action: "kind-changed",
			kind: "PATTERN",
			userId: "2",
			username: "alice",
		});

		await waitFor(() => {
			expect(fetchAndRefreshCase).toHaveBeenCalled();
		});
		expect(screen.queryByTestId("pattern-banner")).not.toBeInTheDocument();
		expect(useStore.getState().assuranceCase?.kind).toBe("CASE");
	});

	it("reads the case once for two conversion events that arrive together", async () => {
		const send = await openEditor("CASE");
		vi.mocked(fetchAndRefreshCase).mockResolvedValue(
			caseOfKind("CASE") as never
		);

		send({ action: "kind-changed", kind: "PATTERN", userId: "2" });
		send({ action: "kind-changed", kind: "CASE", userId: "2" });

		await waitFor(() => {
			expect(fetchAndRefreshCase).toHaveBeenCalled();
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 450));
		});
		expect(fetchAndRefreshCase).toHaveBeenCalledTimes(1);
		expect(useStore.getState().assuranceCase?.kind).toBe("CASE");
	});
});
