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
import { getLayoutedElements } from "@/lib/case/layout-helper";
import type {
	AssuranceCaseResponse,
	UserResponse,
} from "@/lib/services/case-response-types";
import type { CommentResponse } from "@/lib/services/comment-service";
import { nodeTypes } from "@/store/node-types";
import { initEdges } from "./edges";
import { initNodes } from "./nodes";

// Define types for orphaned elements
interface OrphanedElement {
	id: string;
	name: string;
	type: string;
	[key: string]: unknown;
}

// Define type for members (users with permissions)
interface Member {
	email: string;
	id: number | string;
	permissionId?: string;
	username: string;
}

interface Store {
	activeUsers: UserResponse[];
	assuranceCase: AssuranceCaseResponse | null;
	caseNotes: CommentResponse[];
	commentsSheetNode: Node | null;
	// Comments sheet state
	commentsSheetOpen: boolean;
	edges: Edge[];
	editMembers: Member[];
	fitView: () => void;
	layoutDirection: "TB" | "LR";
	layoutNodes: (nodes: Node[], edges: Edge[]) => Promise<void>;
	nodeComments: CommentResponse[];
	nodes: Node[];
	nodeTypes: NodeTypes;
	onConnect: OnConnect;
	onEdgesChange: OnEdgesChange;
	onNodesChange: OnNodesChange;
	orphanedElements: OrphanedElement[];
	reviewMembers: Member[];
	setActiveUsers: (users: UserResponse[]) => void;
	setAssuranceCase: (assuranceCase: AssuranceCaseResponse | null) => void;
	setCaseNotes: (comments: CommentResponse[]) => void;
	setCommentsSheetNode: (node: Node | null) => void;
	setCommentsSheetOpen: (open: boolean) => void;
	setEdges: (edges: Edge[]) => void;
	setEditMembers: (members: Member[]) => void;
	setLayoutDirection: (dir: "TB" | "LR") => void;
	setNodeComments: (comments: CommentResponse[]) => void;
	setNodes: (nodes: Node[]) => void;
	setOrphanedElements: (
		orphanedElements:
			| OrphanedElement[]
			| {
					contexts?: OrphanedElement[];
					propertyClaims?: OrphanedElement[];
					strategies?: OrphanedElement[];
					evidence?: OrphanedElement[];
			  }
	) => void;
	setReviewMembers: (members: Member[]) => void;
	setViewMembers: (members: Member[]) => void;
	triggerLayout: () => Promise<void>;
	viewMembers: Member[];
}

export interface NodeData {
	color: string;
}

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
	setAssuranceCase: (assuranceCase: AssuranceCaseResponse | null) => {
		// Update the assurance case in the state
		// Note: The Flow component's useEffect handles converting the case to nodes/edges
		// via the convert() function, so we don't need to call layoutNodes here
		set({ assuranceCase });
	},
	setOrphanedElements: (
		orphanedElements:
			| OrphanedElement[]
			| {
					contexts?: OrphanedElement[];
					propertyClaims?: OrphanedElement[];
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
		addElementsToArray(orphanedElements.propertyClaims, newArray);
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
	layoutDirection: "TB",
	setLayoutDirection: (dir: "TB" | "LR") => {
		set({ layoutDirection: dir });
	},
	fitView: () => {
		// Placeholder function for fitView - to be implemented when needed
	},
	layoutNodes: async (nodes: Node[], edges: Edge[]) => {
		// Layout nodes using ELK
		const direction = get().layoutDirection;
		const { nodes: layoutedNodes, edges: layoutedEdges } =
			await getLayoutedElements(nodes, edges, { direction });

		// Set the layouted nodes and edges
		set({ nodes: layoutedNodes, edges: layoutedEdges });
	},
	triggerLayout: async () => {
		// Re-layout current nodes and edges (used when node sizes change)
		const { nodes, edges, layoutDirection } = get();
		const { nodes: layoutedNodes, edges: layoutedEdges } =
			await getLayoutedElements(nodes, edges, { direction: layoutDirection });
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
	setActiveUsers(users: UserResponse[]) {
		set({ activeUsers: users });
	},
	nodeComments: [],
	setNodeComments: (comments: CommentResponse[]) => {
		// Handle undefined/null comments gracefully
		if (!(comments && Array.isArray(comments))) {
			set({ nodeComments: [] });
			return;
		}
		const sortedComments = [...comments].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		set({ nodeComments: sortedComments });
	},
	caseNotes: [],
	setCaseNotes: (comments: CommentResponse[]) => {
		// Handle undefined/null comments gracefully
		if (!(comments && Array.isArray(comments))) {
			set({ caseNotes: [] });
			return;
		}
		const sortedComments = [...comments].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		set({ caseNotes: sortedComments });
	},
	// Comments sheet state
	commentsSheetOpen: false,
	commentsSheetNode: null,
	setCommentsSheetOpen: (open: boolean) => {
		set({ commentsSheetOpen: open });
		// Clear node when closing
		if (!open) {
			set({ commentsSheetNode: null });
		}
	},
	setCommentsSheetNode: (node: Node | null) => {
		set({ commentsSheetNode: node });
	},
}));

export default useStore;
