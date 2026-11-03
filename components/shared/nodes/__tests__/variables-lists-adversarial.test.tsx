import { configure, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DefinedTerm, termsInReach } from "@/lib/case/defined-terms";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import { AttachElementDialog } from "../attach-element-dialog";
import { MoveElementDialog } from "../move-element-dialog";
import NodeOptionsMenu from "../node-options-menu";

// The dialogs, editors and cards are slow to settle on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

/**
 * The lists that show an element's text in plain form, the move and attach
 * dialogs and the detach that feeds them: a variable's value shows as it was
 * written and is not read a second time as a reference.
 */

const mockNodes: { current: Node[] } = { current: [] };

vi.mock("reactflow", () => ({
	ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
	useNodes: () => mockNodes.current,
	useEdges: () => [],
}));

const SYS = "aaaaaaaaaa";
const WIN = "bbbbbbbbbb";

type Entry = Extract<ContextEntry, object>;
const variable = (value?: string, name = "system", id = SYS): Entry => ({
	id,
	name,
	text: "the system under test",
	...(value === undefined ? {} : { value }),
	variable: true,
});
const ordinary = (value: string): Entry => ({
	id: WIN,
	name: "window",
	text: "the moving interval",
	value,
});
function reach(...entries: Entry[]): DefinedTerm[] {
	return termsInReach([{ id: "g1", name: "G1", context: entries }]);
}
const ref = (name: string, id: string) => `{${name}#${id}}`;

function candidate(
	id: number,
	type: string,
	description: string,
	terms: DefinedTerm[]
): Node {
	return {
		id: String(id),
		type,
		position: { x: 0, y: 0 },
		data: { id, name: `C${id}`, description, termsInReach: terms },
	};
}

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
		orphanedElements: [],
	});
}

beforeEach(resetStore);

describe("the move dialog's list of new parents", () => {
	const claim: Node = {
		id: "9",
		type: "property",
		position: { x: 0, y: 0 },
		data: { id: 9, name: "P9", description: "To be moved" },
	};

	function open() {
		return renderWithReactFlow(
			<MoveElementDialog
				node={claim}
				nodeType="evidence"
				onOpenChange={() => undefined}
				open
			/>
		);
	}

	it("lists each parent's text with a variable as its value, an unset one as [name] and an ordinary term as {name}", () => {
		mockNodes.current = [
			candidate(
				1,
				"property",
				`The ${ref("system", SYS)} works`,
				reach(variable("AcmeBot"))
			),
			candidate(
				2,
				"property",
				`The ${ref("system", SYS)} waits`,
				reach(variable())
			),
			candidate(
				3,
				"property",
				`In the ${ref("window", WIN)}`,
				reach(ordinary("5 minutes"))
			),
		];

		open();

		expect(screen.getByText("The AcmeBot works")).toBeInTheDocument();
		expect(screen.getByText("The [system] waits")).toBeInTheDocument();
		expect(screen.getByText("In the {window}")).toBeInTheDocument();
		expect(document.body.textContent).not.toContain(SYS);
	});

	it("lists a hostile value as text, once", () => {
		mockNodes.current = [
			candidate(
				1,
				"property",
				`The ${ref("system", SYS)} works`,
				reach(variable("<b>x</b> {other}"))
			),
		];

		open();

		expect(screen.getByText("The <b>x</b> {other} works")).toBeInTheDocument();
		expect(document.querySelector("b")).toBeNull();
	});
});

describe("a detached element in the attach dialog", () => {
	const strategy: Node = {
		id: "1",
		type: "strategy",
		position: { x: 0, y: 0 },
		data: {
			id: 1,
			type: "strategy",
			name: "S1",
			description: `Argue over the ${ref("system", SYS)}`,
			termsInReach: reach(variable("AcmeBot")),
		},
	};
	const parent: Node = {
		id: "5",
		type: "goal",
		position: { x: 0, y: 0 },
		data: { id: 5, name: "G1", description: "A goal" },
	};

	async function detach(node: Node) {
		const user = userEvent.setup();
		server.use(
			http.post("/api/elements/1/detach", () =>
				HttpResponse.json({}, { status: 200 })
			),
			http.get("/api/cases/case-1", () =>
				HttpResponse.json({
					id: "case-1",
					name: "Case",
					type: "assurance-case",
					permissions: "manage",
					createdDate: new Date().toISOString(),
					comments: [],
				})
			)
		);
		mockNodes.current = [];
		const view = renderWithReactFlow(
			<NodeOptionsMenu node={node} nodeType="strategy" />
		);
		await user.click(screen.getByRole("button"));
		await user.click(await screen.findByText("Detach"));
		await user.click(await screen.findByRole("button", { name: "Detach" }));
		await waitFor(() =>
			expect(useStore.getState().orphanedElements.length).toBeGreaterThan(0)
		);
		view.unmount();
		return useStore.getState().orphanedElements[0];
	}

	it("keeps the words the element showed, with the value", async () => {
		const orphan = await detach(strategy);

		expect(orphan?.description).toBe("Argue over the AcmeBot");
		renderWithReactFlow(
			<AttachElementDialog
				node={parent}
				nodeType="goal"
				onOpenChange={() => undefined}
				open
			/>
		);
		expect(
			await screen.findByText("Argue over the AcmeBot")
		).toBeInTheDocument();
	});

	it("keeps a value that looks like a reference as the text it is, in the list", async () => {
		const value = `{window#${WIN}} here`;
		const orphan = await detach({
			...strategy,
			data: { ...strategy.data, termsInReach: reach(variable(value)) },
		});

		expect(orphan?.description).toBe(`Argue over the ${value}`);
		renderWithReactFlow(
			<AttachElementDialog
				node={parent}
				nodeType="goal"
				onOpenChange={() => undefined}
				open
			/>
		);
		expect(
			await screen.findByText(`Argue over the ${value}`)
		).toBeInTheDocument();
	});
});
