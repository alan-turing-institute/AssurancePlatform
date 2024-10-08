
export const convertAssuranceCase = async (assuranceCase: any) => {
  let caseNodes: any[] = [], caseEdges: any[] = []
  let identifier = 0

  // console.log('Assurance Case', assuranceCase)

  // Create nodes for each child array item
  const goals = assuranceCase.goals

  // Create nodes recursively for goals and their children
  caseNodes = createNodesRecursively(goals, 'goal')

  // Create edges for every node
  caseEdges = createEdgesFromNodes(caseNodes)

  return { caseNodes, caseEdges }
}

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
//   const nodes: any[] = [];

//   items.forEach((item:any) => {
//     const nodeId = crypto.randomUUID();
//     const node = {
//       id: nodeId,
//       type: nodeType,
//       data: { id: item.id, name: item.name, type: item.type, description: item.short_description, ...item },
//       position: { x: 0, y: 50 },
//       hidden: false,
//       height: 64,
//       width: 288
//     };

//     if (parentNodeId) {
//       node.data.parentId = parentNodeId;
//     }

//     nodes.push(node);

//     // Recursively create nodes for child elements
//     if (item.context && item.context.length > 0) {
//       const contextNodes = createNodesRecursively(item.context, 'context', nodeId);
//       nodes.push(...contextNodes);
//     }
//     if (item.property_claims && item.property_claims.length > 0) {
//       const propertyClaimNodes = createNodesRecursively(item.property_claims, 'property', nodeId);
//       nodes.push(...propertyClaimNodes);
//     }
//     if (item.evidence && item.evidence.length > 0) {
//       const evidenceNodes = createNodesRecursively(item.evidence, 'evidence', nodeId);
//       nodes.push(...evidenceNodes);
//     }
//     if (item.strategies && item.strategies.length > 0) {
//       const strategyNodes = createNodesRecursively(item.strategies, 'strategy', nodeId);
//       nodes.push(...strategyNodes);
//     }
//   });

//   return nodes;
// };
