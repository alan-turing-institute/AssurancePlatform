import Dagre from "@dagrejs/dagre";
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
	type NodeTypes,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
} from "reactflow";
import { create } from "zustand";
import { nodeTypes } from "@/data/node-types";
import type { AssuranceCase, Comment as CaseComment, User } from "@/types";
import { initEdges } from "./edges";
import { initNodes } from "./nodes";

// Define types for orphaned elements
type OrphanedElement = {
	id: number;
	type: string;
	name: string;
	[key: string]: unknown;
};

// Define type for members (users with permissions)
type Member = {
	id: number | string;
	email: string;
	username: string;
	permissionId?: string;
};

type Store = {
	assuranceCase: AssuranceCase | null;
	orphanedElements: OrphanedElement[];
	nodes: Node[];
	edges: Edge[];
	nodeTypes: NodeTypes;
	onNodesChange: OnNodesChange;
	onEdgesChange: OnEdgesChange;
	onConnect: OnConnect;
	setAssuranceCase: (assuranceCase: AssuranceCase | null) => void;
	setOrphanedElements: (
		orphanedElements:
			| OrphanedElement[]
			| {
					contexts?: OrphanedElement[];
					property_claims?: OrphanedElement[];
					strategies?: OrphanedElement[];
					evidence?: OrphanedElement[];
			  }
	) => void;
	setNodes: (nodes: Node[]) => void;
	setEdges: (edges: Edge[]) => void;
	layoutNodes: (nodes: Node[], edges: Edge[]) => void;
	fitView: () => void;
	viewMembers: Member[];
	editMembers: Member[];
	reviewMembers: Member[];
	setViewMembers: (members: Member[]) => void;
	setEditMembers: (members: Member[]) => void;
	setReviewMembers: (members: Member[]) => void;
	activeUsers: User[];
	setActiveUsers: (users: User[]) => void;
	nodeComments: CaseComment[];
	setNodeComments: (comments: CaseComment[]) => void;
	caseNotes: CaseComment[];
	setCaseNotes: (comments: CaseComment[]) => void;
};

export type NodeData = {
	color: string;
};

// Define a function to layout nodes vertically using Dagre
const layoutNodesVertically = (nodes: Node[], edges: Edge[]) => {
	const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: "TB" });

	// Set all nodes in the graph, including hidden ones
	for (const node of nodes) {
		g.setNode(node.id, { width: node.width || 100, height: node.height || 50 });
	}

	// Set edges for visible nodes only
	const visibleEdges = edges.filter(
		(edge) => !(edge as Edge & { hidden?: boolean }).hidden
	);
	for (const edge of visibleEdges) {
		g.setEdge(edge.source, edge.target);
	}

	Dagre.layout(g);

	return {
		nodes: nodes.map((node) => {
			const { x, y } = g.node(node.id);
			return { ...node, position: { x, y } };
		}),
		edges,
	};
};

// this is our useStore hook that we can use in our components to get parts of the store and call actions
const useStore = create<Store>((set, get) => ({
	assuranceCase: null,
	orphanedElements: [],
	nodes: initNodes,
	edges: initEdges,
	nodeTypes,
	onNodesChange: (changes: NodeChange[]) => {
		set({
			nodes: applyNodeChanges(changes, get().nodes),
		});
	},
	onEdgesChange: (changes: EdgeChange[]) => {
		set({
			edges: applyEdgeChanges(changes, get().edges),
		});
	},
	onConnect: (connection: Connection) => {
		set({
			edges: addEdge(connection, get().edges),
		});
	},
	setAssuranceCase: (assuranceCase: AssuranceCase | null) => {
		// Update the assurance case in the state
		set({ assuranceCase });

		// Get the current nodes and edges from the state
		const { nodes, edges } = get();

		// Layout the nodes and edges
		get().layoutNodes(nodes, edges);
	},
	setOrphanedElements: (
		orphanedElements:
			| OrphanedElement[]
			| {
					contexts?: OrphanedElement[];
					property_claims?: OrphanedElement[];
					strategies?: OrphanedElement[];
					evidence?: OrphanedElement[];
			  }
	) => {
		// If it's already an array, set it directly
		if (Array.isArray(orphanedElements)) {
			set({ orphanedElements });
			return;
		}

		// Otherwise, it's an object with categorized elements
		const addElementsToArray = (
			elements: OrphanedElement[] | undefined,
			targetArray: OrphanedElement[]
		): void => {
			if (elements && elements.length > 0) {
				targetArray.push(...elements);
			}
		};

		const newArray: OrphanedElement[] = [];

		addElementsToArray(orphanedElements.contexts, newArray);
		addElementsToArray(orphanedElements.property_claims, newArray);
		addElementsToArray(orphanedElements.strategies, newArray);
		addElementsToArray(orphanedElements.evidence, newArray);

		set({ orphanedElements: newArray });
	},
	setNodes: (nodes: Node[]) => {
		set({ nodes });
	},
	setEdges: (edges: Edge[]) => {
		set({ edges });
	},
	fitView: () => {
		// Placeholder function for fitView - to be implemented when needed
	},
	layoutNodes: (nodes: Node[], edges: Edge[]) => {
		// Layout nodes vertically
		const { nodes: layoutedNodes, edges: layoutedEdges } =
			layoutNodesVertically(nodes, edges);

		// Set the layouted nodes and edges
		set({ nodes: layoutedNodes, edges: layoutedEdges });
	},
	viewMembers: [],
	editMembers: [],
	reviewMembers: [],
	setViewMembers: (members: Member[]) => {
		set({ viewMembers: members });
	},
	setEditMembers: (members: Member[]) => {
		set({ editMembers: members });
	},
	setReviewMembers: (members: Member[]) => {
		set({ reviewMembers: members });
	},
	activeUsers: [],
	setActiveUsers(users: User[]) {
		set({ activeUsers: users });
	},
	nodeComments: [],
	setNodeComments: (comments: CaseComment[]) => {
		// Handle undefined/null comments gracefully
		if (!(comments && Array.isArray(comments))) {
			set({ nodeComments: [] });
			return;
		}
		const sortedComments = [...comments].sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
		set({ nodeComments: sortedComments });
	},
	caseNotes: [],
	setCaseNotes: (comments: CaseComment[]) => {
		// Handle undefined/null comments gracefully
		if (!(comments && Array.isArray(comments))) {
			set({ caseNotes: [] });
			return;
		}
		const sortedComments = [...comments].sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
		set({ caseNotes: sortedComments });
	},
}));

export default useStore;
