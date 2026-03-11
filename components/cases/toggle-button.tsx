"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type Edge,
	getConnectedEdges,
	getOutgoers,
	type Node,
	useReactFlow,
} from "reactflow";

import ActionTooltip from "@/components/ui/action-tooltip";
import { toggleHiddenForChildren } from "@/lib/case";
import useStore from "@/store/store";

type ToggleButtonProps = {
	node: Node;
};

const ToggleButton = ({ node }: ToggleButtonProps) => {
	const [hidden, setHidden] = useState<boolean>(false);
	const { nodes, edges, layoutNodes, assuranceCase, setAssuranceCase } =
		useStore();
	const { fitView, getNodes, getEdges } = useReactFlow();

	useEffect(() => {
		const currentNode = nodes.find((n) => n.id === node.id);
		if (currentNode) {
			const { property_claims, strategies } = currentNode.data;

			if (property_claims && property_claims.length > 0) {
				setHidden(property_claims[0].hidden);
			}

			if (strategies && strategies.length > 0) {
				setHidden(strategies[0].hidden);
			}
		}
	}, [node.id, nodes]);

	const stack: Node[] = [];
	const outgoers: Node[] = [];
	const connectedEdges: Edge[] = [];

	const checkTarget = (edge: Edge[], id: string) => {
		const filteredEdges = edge.filter((ed: Edge) => ed.target !== id);
		return filteredEdges;
	};

	const _handleToggle = (e: React.MouseEvent) => {
		e.stopPropagation();

		const currentNodeID = node.id;
		stack.push(node);

		while (stack.length > 0) {
			const lastNode = stack.pop();
			if (!lastNode) {
				continue;
			}

			const childnode = getOutgoers(lastNode, nodes, edges);
			const childedge = checkTarget(
				getConnectedEdges([lastNode], edges),
				currentNodeID.toString()
			);
			for (const goer of childnode) {
				stack.push(goer);
				outgoers.push(goer);
			}
			for (const edge of childedge) {
				connectedEdges.push(edge);
			}
		}

		const childNodeID = outgoers.map((n) => n.id);
		const childEdgeID = connectedEdges.map((edge) => edge.id);

		const updatedNodes = nodes.map((n: Node) => {
			if (childNodeID.includes(n.id)) {
				n.hidden = hidden;
			}
			return n;
		});

		const updatedEdges = edges.map((n: Edge) => {
			if (childEdgeID.includes(n.id)) {
				n.hidden = hidden;
			}
			return n;
		});

		layoutNodes(updatedNodes, updatedEdges);

		window.requestAnimationFrame(() => {
			fitView();
		});

		setHidden(!hidden);
	};

	const handleToggle2 = (e: React.MouseEvent) => {
		e.stopPropagation();

		const hasChildren = edges.some((edge) => edge.source === node.id);
		if (!hasChildren) {
			return;
		}

		setHidden(!hidden);

		const currentNode = nodes.find((n) => n.id === node.id);
		if (currentNode && assuranceCase) {
			// Toggle hidden property for the children of the element with currentNode.data.id
			const updatedAssuranceCase = toggleHiddenForChildren(
				assuranceCase,
				currentNode.data.id
			);
			setAssuranceCase(updatedAssuranceCase);

			// Wait for DOM to update, then re-layout with fresh nodes/edges and fit view
			// Use 500ms to ensure React Flow measures the new sizes.
			setTimeout(() => {
				window.requestAnimationFrame(() => {
					window.requestAnimationFrame(() => {
						window.requestAnimationFrame(() => {
							const currentNodes = getNodes();
							const currentEdges = getEdges();
							layoutNodes(currentNodes, currentEdges).then(() => {
								fitView();
							});
						});
					});
				});
			}, 500);
		}
	};

	const hasChildren = edges.some((edge) => edge.source === node.id);
	if (!hasChildren) {
		return null;
	}

	return (
		<ActionTooltip label="Show/Hide children">
			<button
				onClick={(e) => handleToggle2(e)}
				onMouseDown={(e) => e.stopPropagation()}
				type="button"
			>
				<div className="inline-flex rounded-full p-1 hover:bg-foreground/10">
					{hidden ? <EyeOff size={16} /> : <Eye size={16} />}
				</div>
			</button>
		</ActionTooltip>
	);
};

export default ToggleButton;
