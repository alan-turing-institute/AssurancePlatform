import Dagre from "@dagrejs/dagre";

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

/**
 * Generates a layout for the given nodes and edges using Dagre's graph layout algorithm.
 *
 * This function processes the visible nodes and edges in a graph, applies a directed layout
 * (e.g., top-down, left-right), and returns the nodes with updated positions based on the layout.
 * Hidden nodes and edges are ignored during the layout computation but retained in the final output.
 *
 * @param {Array} nodes - An array of node objects representing the graph nodes. Each node should have an `id`, and optionally, a `hidden` property.
 * @param {Array} edges - An array of edge objects representing the graph edges. Each edge should specify `source` and `target` node IDs, and optionally, a `hidden` property.
 * @param {Object} options - Layout options for the graph.
 * @param {string} options.direction - The layout direction, such as 'LR' (left-right) or 'TB' (top-bottom).
 * @returns {Object} An object containing the nodes with updated positions and the original edges.
 */
export const getLayoutedElements = (nodes, edges, options) => {
  // Clear the graph before processing
  g.nodes().forEach((n) => g.removeNode(n));

  // Set the graph layout direction and spacing
  g.setGraph({
    rankdir: options.direction || 'TB',
    ranksep: 120,      // Vertical spacing between ranks/levels
    nodesep: 80,       // Horizontal spacing between nodes at same level
    marginx: 40,       // Margin around the graph
    marginy: 40,       // Margin around the graph
  });

  // Filter out hidden nodes and edges for the layout computation
  const visibleNodes = nodes.filter((node) => !node.hidden);
  const visibleEdges = edges.filter((edge) => !edge.hidden);

  // Add nodes to the graph based on visible nodes
  for (const node of visibleNodes) {
    // Set node dimensions based on node type
    let width = 250;
    let height = 100;

    if (node.type === 'goal') {
      width = 260;
      height = 110;
    } else if (node.type === 'strategy') {
      width = 250;
      height = 90;
    } else if (node.type === 'propertyClaimNode') {
      width = 240;
      height = 80;
    } else if (node.type === 'evidence') {
      width = 220;
      height = 70;
    } else if (node.type === 'context') {
      width = 200;
      height = 60;
    }

    g.setNode(node.id, {
      width: node.width || width,
      height: node.height || height,
    });
  }

  // Add edges to the graph based on visible edges
  for (const edge of visibleEdges) {
    g.setEdge(edge.source, edge.target);
  }

  // Compute the layout using Dagre's layout algorithm
  Dagre.layout(g);

  // Return the nodes with updated positions (only for visible nodes) and the original edges
  return {
    nodes: nodes.map((node) => {
      // Only update the position for visible nodes
      if (!node.hidden) {
        const nodeWithPosition = g.node(node.id);
        if (nodeWithPosition) {
          const { x, y } = nodeWithPosition;
          // Center the node position (dagre returns top-left corner)
          return {
            ...node,
            position: {
              x: x - (nodeWithPosition.width / 2),
              y: y - (nodeWithPosition.height / 2)
            }
          };
        }
      }
      return node;
    }),
    edges,
  };
};

/**
 * Helper function to apply layout and animate the transition
 * @param {Array} nodes - Current nodes
 * @param {Array} edges - Current edges
 * @param {string} direction - Layout direction
 * @returns {Object} Layouted nodes and edges
 */
export const applyLayoutWithAnimation = (nodes, edges, direction = 'TB') => {
  const layouted = getLayoutedElements(nodes, edges, { direction });

  // Add animation properties to nodes for smooth transition
  const animatedNodes = layouted.nodes.map(node => ({
    ...node,
    style: {
      ...node.style,
      transition: 'all 0.5s ease-in-out'
    }
  }));

  return {
    nodes: animatedNodes,
    edges: layouted.edges
  };
};
