/**
 * Convert Assurance Case
 * 
 * This function is used to take an assurance case object and passes the goals array to other functions to convert into Nodes and Edges - which are required for ReactFlow.
 * 
 * @param {Object} assuranceCase - Assurance case object retrieved from the database
 * 
 */
export const convertAssuranceCase = async (assuranceCase: any) => {
  let caseNodes: any[] = [], caseEdges: any[] = []

  // Create nodes for each child array item
  const goals = assuranceCase.goals

  // Create nodes recursively for goals and their children
  caseNodes = createNodesRecursively(goals, 'goal')

  // Create edges for every node
  caseEdges = createEdgesFromNodes(caseNodes)

  return { caseNodes, caseEdges }
}

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
const createNodesRecursively = (items: any, nodeType: string, parentNode: any | null = null, processedItems = new Set(), depth = 10) => {
  const nodes: any[] = [];

  if (depth <= 0) {
    console.error("Maximum recursion depth reached");
    return nodes;
  }

  items.forEach((item: any) => {
    // Check if the item has already been processed
    if (processedItems.has(item)) {
      return;
    }

    const nodeId = crypto.randomUUID();
    const node = {
      id: nodeId,
      type: nodeType,
      data: { id: item.id, name: item.name, type: item.type, description: item.short_description, ...item },
      position: { x: 0, y: 50 },
      // hidden: nodeType === 'goal' ? false : true,
      hidden: item.hidden,
      height: 64,
      width: 288
    };

    if (parentNode) {
      node.data.parentId = parentNode.id;
    }

    nodes.push(node);

    // Add the current item to the set of processed items
    processedItems.add(item);

    // Recursively create nodes for child elements
    if (item.context && item.context.length > 0) {
      const contextNodes = createNodesRecursively(item.context, 'context', node, processedItems, depth - 1);
      nodes.push(...contextNodes);
    }
    if (item.property_claims && item.property_claims.length > 0) {
      const propertyClaimNodes = createNodesRecursively(item.property_claims, 'property', node, processedItems, depth - 1);
      nodes.push(...propertyClaimNodes);
    }
    if (item.evidence && item.evidence.length > 0) {
      const evidenceNodes = createNodesRecursively(item.evidence, 'evidence', node, processedItems, depth - 1);
      nodes.push(...evidenceNodes);
    }
    if (item.strategies && item.strategies.length > 0) {
      const strategyNodes = createNodesRecursively(item.strategies, 'strategy', node, processedItems, depth - 1);
      nodes.push(...strategyNodes);
    }
  });

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
const createEdgesFromNodes = (nodes:any[]) => {
  const edges:any[] = [];

  nodes.forEach(node => {
    // Get the ID of the current node
    const currentNodeId = node.id;

    // Check if the node has a parentId (indicating it is a child node)
    if (node.data.parentId) {
      // Create an edge from the parent node to the current node
      const edgeId = `e${crypto.randomUUID()}`;
      const edge = {
        id: edgeId,
        source: node.data.parentId,
        target: currentNodeId,
        animated: (node.type === 'context'),
        sourceHandle: 'c',
        // sourceHandle: node.type === 'context' ? 'a' : 'c',
        hidden: false
      };

      edges.push(edge);
    }
  });

  return edges;
};