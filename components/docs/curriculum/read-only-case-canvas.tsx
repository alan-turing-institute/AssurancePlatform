"use client";

/**
 * TEA Docs D7: renders a static curriculum case on the REAL case canvas —
 * `components/cases/node-type-resolver.ts`'s node/edge components,
 * `lib/case/convert-case.ts`'s converter, and `lib/case/layout-helper.ts`'s
 * ELK layout — instead of the parallel viewer this replaced under
 * `components/docs/curriculum/enhanced/`.
 *
 * Deliberately thin: no auth, no fetch, no SSE, no mutations. Interaction
 * (node selection/expansion, pan/zoom) is exactly what the real node
 * components already provide; there is nothing docs-specific to add.
 *
 * Coupling note: the real node components (`BaseNode`, `NodeActionGroup`,
 * `ToggleButton`, …) read `assuranceCase`/`nodes`/`edges`/`layoutNodes`
 * from `store/store.ts`'s `useStore` — an app-wide Zustand singleton, not
 * a prop or a scoped context. Setting `permissions: "view"` there is what
 * makes the real editor's existing view-only behaviour apply (hides
 * Add/Options-menu per `NodeActionGroup`, hides History/Reset-IDs/Export/
 * Share/Delete per `ActionButtons` — none of which we render here). But
 * because the store is a singleton, this canvas must clear it on unmount
 * so a later visit to a real `/case/<id>` page in the same browser session
 * does not briefly inherit docs-page state before its own fetch resolves.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
	Background,
	Controls,
	ReactFlowProvider,
	useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { Loader2 } from "lucide-react";
import ChallengesEdge from "@/components/cases/challenges-edge";
import { nodeTypes } from "@/components/cases/node-type-resolver";
import SupportEdge from "@/components/cases/support-edge";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import { getHighlightedEdges } from "@/lib/case/edge-highlight";
import { getLayoutedElements } from "@/lib/case/layout-helper";
import { caseExportToAssuranceCase } from "@/lib/docs/case-export-to-assurance-case";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import useStore from "@/store/store";

const edgeTypes = {
	challenges: ChallengesEdge,
	support: SupportEdge,
};

export interface ReadOnlyCaseCanvasProps {
	/** A case in the same v1.0 nested export format the import/export pipeline uses. */
	caseData: CaseExportNested;
}

function ReadOnlyCaseCanvasInner({ caseData }: ReadOnlyCaseCanvasProps) {
	const { fitView } = useReactFlow();
	const {
		nodes,
		edges,
		onNodesChange,
		setNodes,
		setEdges,
		setAssuranceCase,
		setReadOnlyCanvas,
	} = useStore();
	const [loading, setLoading] = useState(true);

	// `useReactFlow()`'s returned functions are not referentially stable
	// across renders, so `fitView` is read through a ref rather than listed
	// as an effect dependency below — putting it in the dependency array
	// tears the effect down and rebuilds it on every render (confirmed by a
	// spike diagnostic: 160+ effect re-runs in a few seconds), which repeatedly
	// clears and reloads the case, self-sustaining.
	const fitViewRef = useRef(fitView);
	fitViewRef.current = fitView;

	// Separate from the case-loading effect below (which re-runs per stage,
	// i.e. per `caseData` change): this flag is a property of the canvas
	// itself, not of which case it's currently showing, so it's set once for
	// the component's whole lifetime — see `NodeActionGroup` for what it hides.
	useEffect(() => {
		setReadOnlyCanvas(true);
		return () => setReadOnlyCanvas(false);
	}, [setReadOnlyCanvas]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		const assuranceCase = caseExportToAssuranceCase(caseData);
		setAssuranceCase(assuranceCase);

		const { caseNodes, caseEdges } = convertAssuranceCase({
			...assuranceCase,
			goals: assuranceCase.goals || [],
		});
		getLayoutedElements(caseNodes, caseEdges, { direction: "TB" }).then(
			(layouted) => {
				if (cancelled) {
					return;
				}
				setNodes(layouted.nodes);
				setEdges(layouted.edges);
				setLoading(false);
				window.requestAnimationFrame(() => fitViewRef.current());
			}
		);

		return () => {
			cancelled = true;
			// Belt-and-braces: a real case page's own CaseContainer overwrites
			// this on its own mount too, but clearing here closes the gap
			// before that fetch resolves.
			setAssuranceCase(null);
			setNodes([]);
			setEdges([]);
		};
	}, [caseData, setAssuranceCase, setNodes, setEdges]);

	const displayEdges = useMemo(
		() => getHighlightedEdges(edges, nodes),
		[edges, nodes]
	);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<ReactFlow
			edges={displayEdges}
			edgeTypes={edgeTypes}
			fitView
			nodes={nodes}
			nodesDraggable={false}
			nodeTypes={nodeTypes}
			onNodesChange={onNodesChange}
		>
			<Controls />
			<Background />
		</ReactFlow>
	);
}

export default function ReadOnlyCaseCanvas(props: ReadOnlyCaseCanvasProps) {
	return (
		<ReactFlowProvider>
			<ReadOnlyCaseCanvasInner {...props} />
		</ReactFlowProvider>
	);
}
