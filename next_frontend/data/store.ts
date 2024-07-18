import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  NodeTypes,
} from 'reactflow';
import { initNodes } from './nodes';
import { initEdges } from './edges';
import { nodeTypes } from './nodeTypes';
import Dagre from '@dagrejs/dagre';

type Store = {
  assuranceCase: any;
  orphanedElements: any[]
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setAssuranceCase: (assuranceCase: any) => void;
  setOrphanedElements: (orphanedElements: any) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  layoutNodes: (nodes: Node[], edges: Edge[]) => void;
};

export type NodeData = {
  color: string;
};

// Define a function to layout nodes vertically using Dagre
const layoutNodesVertically = (nodes: Node[], edges: Edge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB' });

  // Set all nodes in the graph, including hidden ones
  nodes.forEach((node: any) => g.setNode(node.id, node));

  // Set edges for visible nodes only
  const visibleEdges = edges.filter((edge: any) => !edge.hidden);
  visibleEdges.forEach((edge: any) => g.setEdge(edge.source, edge.target));

  Dagre.layout(g);

  return {
    nodes: nodes.map((node: any) => {
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
  nodeTypes: nodeTypes,
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
  setAssuranceCase: (assuranceCase: any) => {
    // Update the assurance case in the state
    set({ assuranceCase });

    // Get the current nodes and edges from the state
    const { nodes, edges } = get();

    // Layout the nodes and edges
    get().layoutNodes(nodes, edges);
  },
  setOrphanedElements: (orphanedElements: any) => {
    console.log('orphanedElements_Sandbox', orphanedElements)
    let newArray: any[] = []

    if (orphanedElements.contexts && orphanedElements.contexts.length > 0) {
      orphanedElements.contexts.map((context: any) => {
        newArray.push(context)
      })
    }

    if (orphanedElements.property_claims && orphanedElements.property_claims.length > 0) {
      orphanedElements.property_claims.map((claim: any) => {
        newArray.push(claim)
      })
    }

    if (orphanedElements.strategies && orphanedElements.strategies.length > 0) {
      orphanedElements.strategies.map((strategy: any) => {
        newArray.push(strategy)
      })
    }

    if (orphanedElements.evidence && orphanedElements.evidence.length > 0) {
      orphanedElements.evidence.map((evidence: any) => {
        newArray.push(evidence)
      })
    }

    set({ orphanedElements: newArray })
  },
  setNodes: (nodes: Node[]) => {
    set({ nodes });
  },
  setEdges: (edges: Edge[]) => {
    set({ edges });
  },
  fitView: () => {}, // Define fitView function
  layoutNodes: (nodes: Node[], edges: Edge[]) => {
    // Layout nodes vertically
    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodesVertically(nodes, edges);

    // Set the layouted nodes and edges
    set({ nodes: layoutedNodes, edges: layoutedEdges });
  },
}));

export default useStore;
