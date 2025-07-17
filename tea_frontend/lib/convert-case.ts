import type { Edge, Node } from 'reactflow';
import type { Evidence, Goal, PropertyClaim, Strategy } from '@/types';

// Define the structure of items that can be converted to nodes
export interface ConvertibleItem {
  id: number;
  name: string;
  type: string;
  short_description?: string;
  hidden?: boolean;
  context?: ConvertibleItem[];
  strategies?: Strategy[];
  property_claims?: PropertyClaim[];
  evidence?: Evidence[];
  [key: string]: unknown;
}

// Define the structure of the assurance case
export interface AssuranceCaseWithGoals {
  goals: Goal[];
  [key: string]: unknown;
}

/**
 * Convert Assurance Case
 *
 * This function is used to take an assurance case object and passes the goals array to other functions to convert into Nodes and Edges - which are required for ReactFlow.
 *
 * @param {Object} assuranceCase - Assurance case object retrieved from the database
 *
 */
export const convertAssuranceCase = (assuranceCase: AssuranceCaseWithGoals) => {
  let caseNodes: Node[] = [],
    caseEdges: Edge[] = [];

  // Create nodes for each child array item
  const goals = assuranceCase.goals;

  // Create nodes recursively for goals and their children
  caseNodes = createNodesRecursively(
    goals as unknown as ConvertibleItem[],
    'goal'
  );

  // Create edges for every node
  caseEdges = createEdgesFromNodes(caseNodes);

  return { caseNodes, caseEdges };
};

/**
 * Recursively creates nodes from a hierarchical structure of items, with support for various child types.
 *
 * This function generates nodes from an array of items, each having potentially nested child elements such as
 * `context`, `property_claims`, `evidence`, or `strategies`. The nodes are structured with unique IDs and are
 * positioned in a graph-like format. The recursion depth is limited to prevent infinite loops, and processed
 * items are tracked to avoid duplicating nodes.
 *
 * @param {any[]} items - An array of items from which nodes will be created. Each item can have nested child elements.
 * @param {string} nodeType - The type of node to be created for the current set of items (e.g., 'goal', 'context', 'property').
 * @param {any|null} [parentNode=null] - The parent node to which the newly created nodes will be linked. Defaults to null for root nodes.
 * @param {Set<any>} [processedItems=new Set()] - A set to track already processed items to prevent duplicates.
 * @param {number} [depth=10] - The maximum recursion depth to avoid infinite recursion. Defaults to 10.
 * @returns {any[]} An array of created nodes with their hierarchical relationships preserved.
 *
 */
export const createNodesRecursively = (
  items: ConvertibleItem[],
  nodeType: string,
  parentNode: Node | null = null,
  processedItems = new Set<ConvertibleItem>(),
  depth = 10
): Node[] => {
  const nodes: Node[] = [];

  if (depth <= 0) {
    return nodes;
  }

  for (const item of items) {
    // Check if the item has already been processed
    if (processedItems.has(item)) {
      continue;
    }

    const nodeId = crypto.randomUUID();
    const node: Node = {
      id: nodeId,
      type: nodeType,
      data: {
        ...item,
        id: item.id,
        name: item.name,
        type: item.type,
        description: item.short_description,
      },
      position: { x: 0, y: 50 },
      // hidden: nodeType === 'goal' ? false : true,
      hidden: item.hidden,
      height: 64,
      width: 288,
    };

    if (parentNode) {
      node.data.parentId = parentNode.id;
    }

    nodes.push(node);

    // Add the current item to the set of processed items
    processedItems.add(item);

    // Recursively create nodes for child elements

    /*  DEPRECATED - REMOVE CONTEXT NODES
        https://github.com/orgs/alan-turing-institute/projects/240/views/1?pane=issue&itemId=86520648&issue=alan-turing-institute%7CAssurancePlatform%7C652
    */
    // if (item.context && item.context.length > 0) {
    //   const contextNodes = createNodesRecursively(item.context, 'context', node, processedItems, depth - 1);
    //   nodes.push(...contextNodes);
    // }
    if (item.strategies && item.strategies.length > 0) {
      const strategyNodes = createNodesRecursively(
        item.strategies as unknown as ConvertibleItem[],
        'strategy',
        node,
        processedItems,
        depth - 1
      );
      nodes.push(...strategyNodes);
    }
    if (item.property_claims && item.property_claims.length > 0) {
      const propertyClaimNodes = createNodesRecursively(
        item.property_claims as unknown as ConvertibleItem[],
        'property',
        node,
        processedItems,
        depth - 1
      );
      nodes.push(...propertyClaimNodes);
    }
    if (item.evidence && item.evidence.length > 0) {
      const evidenceNodes = createNodesRecursively(
        item.evidence as unknown as ConvertibleItem[],
        'evidence',
        node,
        processedItems,
        depth - 1
      );
      nodes.push(...evidenceNodes);
    }
  }

  return nodes;
};

/**
 * Creates edges from a list of nodes to represent relationships between parent and child nodes.
 *
 * This function generates edges (links) between nodes in a graph where each node may have a parent-child relationship.
 * The edges are created by linking the `parentId` of a node to the node's `id`. Special handling is applied to nodes
 * of type 'context', which results in animated edges.
 *
 * @param {any[]} nodes - An array of nodes, where each node can optionally have a `parentId` in its data to signify a parent-child relationship.
 * @returns {any[]} An array of edges, where each edge links a parent node to a child node.
 *
 */
export const createEdgesFromNodes = (nodes: Node[]): Edge[] => {
  const edges: Edge[] = [];

  for (const node of nodes) {
    // Get the ID of the current node
    const currentNodeId = node.id;

    // Check if the node has a parentId (indicating it is a child node)
    if (node.data.parentId) {
      // Create an edge from the parent node to the current node
      const edgeId = `e${crypto.randomUUID()}`;
      const edge: Edge = {
        id: edgeId,
        source: node.data.parentId as string,
        target: currentNodeId,
        animated: node.type === 'context',
        sourceHandle: 'c',
        // sourceHandle: node.type === 'context' ? 'a' : 'c',
        hidden: false,
      };

      edges.push(edge);
    }
  }

  return edges;
};
