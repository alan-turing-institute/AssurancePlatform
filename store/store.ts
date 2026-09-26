import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
} from "reactflow";
import { create } from "zustand";
import { getLayoutedElements } from "@/lib/case/layout-helper";
import { logger } from "@/lib/logger";
import type {
	AssuranceCaseResponse,
	UserResponse,
} from "@/lib/services/case-response-types";
import type { CommentResponse } from "@/lib/services/comment-service";
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
	// Case information sheet state (ADR 0003 §1/§2 — the title-click sheet and
	// the toolbar's "Case Information" button are two entry points onto the
	// same component; both flip this one flag so the sheet lives in a single
	// place in the tree, same pattern as `commentsSheetOpen` below).
	caseDetailsOpen: boolean;
	// Name of the case-information field the sheet should focus once it
	// opens — set by the publish flow (ADR 0003 §2 "surfaces exactly those
	// gaps... opening the case information form focused on them") when a
	// required field is missing. `CaseInformationSection` consumes and
	// clears it after focusing, so it doesn't stick around for the next
	// manual open.
	caseInformationFocusField: string | null;
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
	onConnect: OnConnect;
	onEdgesChange: OnEdgesChange;
	onNodesChange: OnNodesChange;
	orphanedElements: OrphanedElement[];
	// True while a read-only, non-case canvas (the curriculum docs viewer,
	// `components/docs/curriculum/read-only-case-canvas.tsx`) has this store
	// populated. Distinct from `assuranceCase.permissions === "view"`, which
	// a real, authenticated view-only case member also has and which must
	// keep showing NodeActionGroup's comment button — this flag exists so
	// that button can be hidden specifically where there is no
	// `CommentsSheet` mounted to open, without changing that permission's
	// existing meaning for `/case/<id>`.
	readOnlyCanvas: boolean;
	reviewMembers: Member[];
	setActiveUsers: (users: UserResponse[]) => void;
	setAssuranceCase: (assuranceCase: AssuranceCaseResponse | null) => void;
	setCaseDetailsOpen: (open: boolean) => void;
	setCaseInformationFocusField: (field: string | null) => void;
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
	setReadOnlyCanvas: (readOnlyCanvas: boolean) => void;
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
		// Layout nodes using ELK. getLayoutedElements itself never rejects
		// (it falls back to the pre-layout positions on an ELK failure), but
		// this catch is a second line of defence so a regression there can't
		// leave the canvas stuck with whatever was on screen mid-conversion.
		const direction = get().layoutDirection;
		try {
			const { nodes: layoutedNodes, edges: layoutedEdges } =
				await getLayoutedElements(nodes, edges, { direction });
			set({ nodes: layoutedNodes, edges: layoutedEdges });
		} catch (error) {
			logger.error("layoutNodes failed; keeping pre-layout positions", {
				error,
			});
			set({ nodes, edges });
		}
	},
	triggerLayout: async () => {
		// Re-layout current nodes and edges (used when node sizes change).
		// Same belt-and-braces catch as layoutNodes above.
		const { nodes, edges, layoutDirection } = get();
		try {
			const { nodes: layoutedNodes, edges: layoutedEdges } =
				await getLayoutedElements(nodes, edges, { direction: layoutDirection });
			set({ nodes: layoutedNodes, edges: layoutedEdges });
		} catch (error) {
			logger.error("triggerLayout failed; keeping current positions", {
				error,
			});
		}
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
	// Case information sheet state
	caseDetailsOpen: false,
	setCaseDetailsOpen: (open: boolean) => {
		set({ caseDetailsOpen: open });
	},
	caseInformationFocusField: null,
	setCaseInformationFocusField: (field: string | null) => {
		set({ caseInformationFocusField: field });
	},
	// Read-only docs canvas flag (see the interface doc comment above)
	readOnlyCanvas: false,
	setReadOnlyCanvas: (readOnlyCanvas: boolean) => {
		set({ readOnlyCanvas });
	},
}));

export default useStore;
