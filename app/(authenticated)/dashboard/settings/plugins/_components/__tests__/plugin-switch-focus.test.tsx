import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginCard } from "../plugin-card";
import { PluginOffConfirmDialog } from "../plugin-off-confirm-dialog";
import { PluginsSection } from "../plugins-section";

type User = ReturnType<typeof userEvent.setup>;

const PLUGINS_URL = "/api/user/plugins";
const CONSEQUENCES_URL = "/api/user/plugins/tea.health/consequences";
const PLUGIN_NAME = "Claim/Evidence Health";
const TURN_ON_LABEL = `Turn ${PLUGIN_NAME} on`;
const TURN_OFF_LABEL = `Turn ${PLUGIN_NAME} off`;

function makePlugin(
	overrides: Partial<PluginSettingsListItem> = {}
): PluginSettingsListItem {
	return {
		pluginId: "tea.health",
		name: PLUGIN_NAME,
		version: "0.1.0",
		description: "Shows whether the evidence behind each claim still holds.",
		surfaces: ["element-badge"],
		available: true,
		enabled: true,
		pinnedAt: null,
		settings: null,
		...overrides,
	};
}

function serveConsequences() {
	server.use(
		http.get(CONSEQUENCES_URL, () =>
			HttpResponse.json({
				evidenceRecordCount: 0,
				caseCount: 0,
				activeIntegrations: [],
			})
		)
	);
}

/** A promise the test resolves by hand, to hold a request mid-flight. */
function createGate() {
	let release: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

/**
 * Serves the page's plugin list and a PATCH that stays in flight until the
 * gate is released, so the save can be observed while it is happening.
 */
function serveHeldSave(initiallyEnabled: boolean) {
	const gate = createGate();
	const state = { enabled: initiallyEnabled, patches: [] as boolean[] };
	server.use(
		http.get(PLUGINS_URL, () =>
			HttpResponse.json({ plugins: [makePlugin({ enabled: state.enabled })] })
		),
		http.patch(PLUGINS_URL, async ({ request }) => {
			const body = (await request.json()) as { enabled: boolean };
			state.patches.push(body.enabled);
			await gate.promise;
			state.enabled = body.enabled;
			return HttpResponse.json({
				pluginId: "tea.health",
				enabled: body.enabled,
				settings: null,
			});
		})
	);
	return { gate, state };
}

/** Focuses the first tab stop, which is the switch, as a keyboard user would. */
async function tabToSwitch(user: User) {
	await user.tab();
	const toggle = screen.getByRole("switch");
	if (document.activeElement !== toggle) {
		throw new Error("The first tab stop is not the plugin switch");
	}
	return toggle;
}

async function openTurnOffDialog(user: User, toggle: HTMLElement) {
	await user.click(toggle);
	await screen.findByRole("alertdialog");
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Keep on" })).toHaveFocus()
	);
}

async function expectDialogClosed() {
	await waitFor(() =>
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
	);
}

/** Every way the turn-off dialog closes, with the number of saves it starts. */
const CLOSE_PATHS: ReadonlyArray<
	readonly [string, (user: User) => Promise<void>, number]
> = [
	["Escape", (user) => user.keyboard("{Escape}"), 0],
	[
		"Keep on",
		(user) => user.click(screen.getByRole("button", { name: "Keep on" })),
		0,
	],
	[
		"Turn off",
		(user) => user.click(screen.getByRole("button", { name: "Turn off" })),
		1,
	],
];

/** The ways a person can try to operate the switch while it saves. */
const INPUTS: ReadonlyArray<readonly [string, (user: User) => Promise<void>]> =
	[
		["Space", (user) => user.keyboard(" ")],
		["Enter", (user) => user.keyboard("{Enter}")],
		["a click", (user) => user.click(screen.getByRole("switch"))],
	];

async function tryEveryInput(user: User) {
	for (const [, input] of INPUTS) {
		await input(user);
	}
}

/** Errors thrown from timers surface as window error events, not rejections. */
async function collectWindowErrorsDuring(run: () => Promise<void>) {
	const errors: unknown[] = [];
	const onError = (event: ErrorEvent) => {
		event.preventDefault();
		errors.push(event.error);
	};
	window.addEventListener("error", onError);
	try {
		await run();
	} finally {
		window.removeEventListener("error", onError);
	}
	return errors;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("PluginCard while a save is in flight", () => {
	it("marks the switch aria-disabled rather than natively disabled, and shows Saving…", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} pending plugin={makePlugin()} />
		);

		const toggle = await tabToSwitch(user);

		expect(toggle).toHaveAttribute("aria-disabled", "true");
		expect(toggle).not.toBeDisabled();
		expect(screen.getByText("Saving…")).toBeInTheDocument();
	});

	it("keeps the same switch element focused when a save starts, and drops aria-disabled when it ends", async () => {
		const user = userEvent.setup();
		const onToggle = vi.fn();
		const plugin = makePlugin();
		const { rerender } = renderWithoutProviders(
			<PluginCard onToggle={onToggle} plugin={plugin} />
		);
		const toggle = await tabToSwitch(user);
		expect(toggle).not.toHaveAttribute("aria-disabled");

		rerender(<PluginCard onToggle={onToggle} pending plugin={plugin} />);
		expect(screen.getByRole("switch")).toBe(toggle);
		expect(toggle).toHaveFocus();
		expect(toggle).toHaveAttribute("aria-disabled", "true");

		rerender(<PluginCard onToggle={onToggle} plugin={plugin} />);
		expect(screen.getByRole("switch")).toBe(toggle);
		expect(toggle).toHaveFocus();
		expect(toggle).not.toHaveAttribute("aria-disabled");
		expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
	});

	describe.each([
		["on", true],
		["off", false],
	])("with the plugin turned %s", (_state, enabled) => {
		it.each(
			INPUTS
		)("ignores %s: no toggle call, no dialog, state unchanged", async (_name, input) => {
			const user = userEvent.setup();
			const onToggle = vi.fn();
			renderWithoutProviders(
				<PluginCard
					onToggle={onToggle}
					pending
					plugin={makePlugin({ enabled })}
				/>
			);
			const toggle = await tabToSwitch(user);

			await input(user);

			expect(onToggle).not.toHaveBeenCalled();
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
			expect(toggle.getAttribute("aria-checked")).toBe(String(enabled));
			expect(toggle).toHaveFocus();
		});
	});

	it("opens the turn-off dialog again once the save has finished", async () => {
		serveConsequences();
		const user = userEvent.setup();
		const onToggle = vi.fn();
		const plugin = makePlugin({ enabled: true });
		const { rerender } = renderWithoutProviders(
			<PluginCard onToggle={onToggle} pending plugin={plugin} />
		);
		await tabToSwitch(user);
		await tryEveryInput(user);
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

		rerender(<PluginCard onToggle={onToggle} plugin={plugin} />);
		await user.keyboard(" ");

		expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
		expect(onToggle).not.toHaveBeenCalled();
	});

	it("turns the plugin on again once the save has finished", async () => {
		const user = userEvent.setup();
		const onToggle = vi.fn();
		const plugin = makePlugin({ enabled: false });
		const { rerender } = renderWithoutProviders(
			<PluginCard onToggle={onToggle} pending plugin={plugin} />
		);
		await tabToSwitch(user);
		await tryEveryInput(user);
		expect(onToggle).not.toHaveBeenCalled();

		rerender(<PluginCard onToggle={onToggle} plugin={plugin} />);
		await user.keyboard(" ");

		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onToggle).toHaveBeenCalledWith("tea.health", true);
	});
});

describe("PluginCard with a plugin the deployment withholds", () => {
	it.each([
		["unavailable on the deployment", { available: false }],
		["turned off by the organisation", { pinnedAt: "ORGANISATION" as const }],
		["turned off by the team", { pinnedAt: "TEAM" as const }],
	])("keeps a natively disabled switch when %s", (_name, overrides) => {
		const onToggle = vi.fn();
		const { rerender } = renderWithoutProviders(
			<PluginCard onToggle={onToggle} plugin={makePlugin(overrides)} />
		);
		expect(screen.getByRole("switch")).toBeDisabled();

		rerender(
			<PluginCard onToggle={onToggle} pending plugin={makePlugin(overrides)} />
		);
		expect(screen.getByRole("switch")).toBeDisabled();
		expect(onToggle).not.toHaveBeenCalled();
	});

	it("cannot be tabbed to, unlike a switch that is only saving", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(
			<PluginCard
				onToggle={vi.fn()}
				plugin={makePlugin({ pinnedAt: "TEAM" })}
			/>
		);

		await user.tab();

		expect(screen.getByRole("switch")).not.toHaveFocus();
	});
});

describe("PluginCard turn-off dialog", () => {
	it.each(
		CLOSE_PATHS
	)("returns focus to the switch when it closes by %s", async (_name, close, saves) => {
		serveConsequences();
		const user = userEvent.setup();
		const onToggle = vi.fn();
		renderWithoutProviders(
			<PluginCard onToggle={onToggle} plugin={makePlugin()} />
		);
		// Held before the dialog opens: the dialog hides its surroundings.
		const toggle = screen.getByRole("switch");
		await openTurnOffDialog(user, toggle);

		await close(user);

		await expectDialogClosed();
		await waitFor(() => expect(toggle).toHaveFocus());
		expect(onToggle).toHaveBeenCalledTimes(saves);
	});

	it("returns focus to a switch that has meanwhile become aria-disabled", async () => {
		serveConsequences();
		const user = userEvent.setup();
		const onToggle = vi.fn();
		const plugin = makePlugin();
		const { rerender } = renderWithoutProviders(
			<PluginCard onToggle={onToggle} plugin={plugin} />
		);
		const toggle = screen.getByRole("switch");
		await openTurnOffDialog(user, toggle);

		rerender(<PluginCard onToggle={onToggle} pending plugin={plugin} />);
		await user.keyboard("{Escape}");

		await expectDialogClosed();
		await waitFor(() => expect(toggle).toHaveFocus());
		expect(toggle).toHaveAttribute("aria-disabled", "true");
		expect(onToggle).not.toHaveBeenCalled();
	});

	it("does not throw when the card goes away while the dialog is open", async () => {
		serveConsequences();
		const user = userEvent.setup();
		const { unmount } = renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} plugin={makePlugin()} />
		);
		await openTurnOffDialog(user, screen.getByRole("switch"));

		const errors = await collectWindowErrorsDuring(async () => {
			unmount();
			// The close handler runs on a timer after the card has unmounted.
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		expect(errors).toEqual([]);
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
	});
});

describe("PluginOffConfirmDialog close focus handler", () => {
	function DialogHarness({
		onCloseAutoFocus,
	}: {
		onCloseAutoFocus: (event: Event) => void;
	}) {
		const [open, setOpen] = useState(true);
		return (
			<PluginOffConfirmDialog
				onCloseAutoFocus={onCloseAutoFocus}
				onConfirm={() => setOpen(false)}
				onOpenChange={setOpen}
				open={open}
				pending={false}
				pluginId="tea.health"
				pluginName={PLUGIN_NAME}
			/>
		);
	}

	it.each(
		CLOSE_PATHS
	)("is called once with an event when the dialog closes by %s, and not before", async (_name, close) => {
		serveConsequences();
		const user = userEvent.setup();
		const onCloseAutoFocus = vi.fn();
		renderWithoutProviders(
			<DialogHarness onCloseAutoFocus={onCloseAutoFocus} />
		);
		await screen.findByRole("alertdialog");
		expect(onCloseAutoFocus).not.toHaveBeenCalled();

		await close(user);

		await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1));
		expect(onCloseAutoFocus).toHaveBeenCalledWith(expect.any(Event));
	});
});

describe("Plugins page: a save held in flight", () => {
	it("keeps focus on the switch while a turn-on saves, ignores input, then shows the new state", async () => {
		const { gate, state } = serveHeldSave(false);
		const user = userEvent.setup();
		renderWithoutProviders(<PluginsSection />);
		await screen.findByRole("switch", { name: TURN_ON_LABEL });
		const toggle = await tabToSwitch(user);

		await user.keyboard(" ");
		await waitFor(() =>
			expect(toggle).toHaveAttribute("aria-disabled", "true")
		);
		expect(toggle).not.toBeDisabled();
		expect(toggle).toHaveFocus();
		expect(screen.getByText("Saving…")).toBeInTheDocument();

		await tryEveryInput(user);
		expect(state.patches).toEqual([true]);
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();

		gate.release();
		await waitFor(() => expect(toggle).toBeChecked());
		expect(screen.getByRole("switch", { name: TURN_OFF_LABEL })).toBe(toggle);
		expect(toggle).not.toHaveAttribute("aria-disabled");
		expect(toggle).toHaveFocus();
		expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
	});

	it("returns focus to the switch after Turn off and keeps it there through the save", async () => {
		serveConsequences();
		const { gate, state } = serveHeldSave(true);
		const user = userEvent.setup();
		renderWithoutProviders(<PluginsSection />);
		const toggle = await screen.findByRole("switch", { name: TURN_OFF_LABEL });
		await openTurnOffDialog(user, toggle);

		await user.click(screen.getByRole("button", { name: "Turn off" }));

		await expectDialogClosed();
		await waitFor(() => expect(toggle).toHaveFocus());
		expect(toggle).toHaveAttribute("aria-disabled", "true");
		expect(toggle).not.toBeDisabled();
		expect(screen.getByText("Saving…")).toBeInTheDocument();

		await tryEveryInput(user);
		expect(state.patches).toEqual([false]);
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();

		gate.release();
		await waitFor(() => expect(toggle).not.toBeChecked());
		expect(screen.getByRole("switch", { name: TURN_ON_LABEL })).toBe(toggle);
		expect(toggle).not.toHaveAttribute("aria-disabled");
		expect(toggle).toHaveFocus();
	});

	it("keeps focus on an unchanged switch through a failed save and then ends the saving state", async () => {
		const gate = createGate();
		const user = userEvent.setup();
		server.use(
			http.get(PLUGINS_URL, () =>
				HttpResponse.json({ plugins: [makePlugin({ enabled: false })] })
			),
			http.patch(PLUGINS_URL, async () => {
				await gate.promise;
				return HttpResponse.json({ error: "Nope" }, { status: 500 });
			})
		);
		renderWithoutProviders(<PluginsSection />);
		await screen.findByRole("switch", { name: TURN_ON_LABEL });
		const toggle = await tabToSwitch(user);

		await user.keyboard(" ");
		await waitFor(() =>
			expect(toggle).toHaveAttribute("aria-disabled", "true")
		);
		expect(toggle).toHaveFocus();

		gate.release();
		await waitFor(() => expect(toggle).not.toHaveAttribute("aria-disabled"));
		expect(screen.getByRole("switch", { name: TURN_ON_LABEL })).toBe(toggle);
		expect(toggle).not.toBeChecked();
		expect(toggle).toHaveFocus();
	});
});
