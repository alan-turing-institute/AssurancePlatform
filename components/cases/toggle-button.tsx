"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type Edge,
	getConnectedEdges,
	getOutgoers,
	type Node,
	useReactFlow,
} from "reactflow";

import useStore from "@/data/store";
import { toggleHiddenForChildren } from "@/lib/case";

type ToggleButtonProps = {
	node: Node;
};

const ToggleButton = ({ node }: ToggleButtonProps) => {
	const [hidden, setHidden] = useState<boolean>(false);
	const { nodes, edges, layoutNodes, assuranceCase, setAssuranceCase } =
		useStore();
	const { fitView } = useReactFlow();

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

		// If toggle on Goal node will force focus
		if (node.type === "goal") {
			window.requestAnimationFrame(() => {
				fitView();
			});
		}

		setHidden(!hidden);
	};

	// const handleToggle = (e: any) => {
	//   e.stopPropagation();

	//   let currentNodeID = node.id;
	//   let stack = [node];
	//   let outgoersSet = new Set();
	//   let connectedEdgesSet = new Set();
	//   let allDescendantsSet = new Set();

	//   if (!hidden) {
	//       // Traverse to hide all children and their descendants
	//       while (stack.length > 0) {
	//           let lastNode = stack.pop();
	//           let childNodes = getOutgoers(lastNode, nodes, edges);
	//           let childEdges = checkTarget(
	//               getConnectedEdges([lastNode], edges),
	//               currentNodeID
	//           );

	//           childNodes.forEach((goer) => {
	//               stack.push(goer);
	//               allDescendantsSet.add(goer.id);
	//           });

	//           childEdges.forEach((edge: any) => {
	//               connectedEdgesSet.add(edge.id);
	//           });
	//       }
	//   } else {
	//       // Identify direct children to show
	//       let childNodes = getOutgoers(node, nodes, edges);
	//       let childEdges = checkTarget(
	//           getConnectedEdges([node], edges),
	//           currentNodeID
	//       );

	//       childNodes.forEach((goer) => {
	//           outgoersSet.add(goer.id);
	//       });

	//       childEdges.forEach((edge: any) => {
	//           connectedEdgesSet.add(edge.id);
	//       });
	//   }

	//   // Ensure the selected node is never hidden
	//   outgoersSet.delete(currentNodeID);
	//   allDescendantsSet.delete(currentNodeID);

	//   const updatedNodes = nodes.map((n) => {
	//       if (n.id === currentNodeID) {
	//           // Ensure the selected node is always visible
	//           return { ...n, hidden: false };
	//       } else if (outgoersSet.has(n.id)) {
	//           // Show direct children when toggling to show
	//           return { ...n, hidden: false };
	//       } else if (allDescendantsSet.has(n.id)) {
	//           // Hide all descendants when toggling to hide
	//           return { ...n, hidden: true };
	//       }
	//       return n;
	//   });

	//   const updatedEdges = edges.map((e) => {
	//       if (connectedEdgesSet.has(e.id)) {
	//           // Toggle visibility of edges connected to direct children or descendants
	//           return { ...e, hidden: !hidden };
	//       }
	//       return e;
	//   });

	//   layoutNodes(updatedNodes, updatedEdges);
	//   window.requestAnimationFrame(() => {
	//       fitView();
	//   });

	//   setHidden(!hidden);
	// }

	const handleToggle2 = (e: React.MouseEvent) => {
		e.stopPropagation();

		setHidden(!hidden);

		const currentNode = nodes.find((n) => n.id === node.id);
		if (currentNode && assuranceCase) {
			// Toggle hidden property for the children of the element with currentNode.data.id
			const updatedAssuranceCase = toggleHiddenForChildren(
				assuranceCase,
				currentNode.data.id
			);
			setAssuranceCase(updatedAssuranceCase);

			if (node.type === "goal") {
				window.requestAnimationFrame(() => {
					fitView();
				});
			}
		}
	};

	return (
		<button onClick={(e) => handleToggle2(e)} type="button">
			<div className="infline-flex rounded-full p-1 hover:bg-slate-900/10">
				{hidden ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
			</div>
		</button>
	);
};

export default ToggleButton;
