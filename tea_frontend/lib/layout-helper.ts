import Dagre from '@dagrejs/dagre';

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

/**
 * Generates a layout for the given nodes and edges using Dagre's graph layout algorithm.
 *
 * This function processes the visible nodes and edges in a graph, applies a directed layout
 * (e.g., top-down, left-right), and returns the nodes with updated positions based on the layout.
 * Hidden nodes and edges are ignored during the layout computation but retained in the final output.
 *
 * @param {any[]} nodes - An array of node objects representing the graph nodes. Each node should have an `id`, and optionally, a `hidden` property.
 * @param {any[]} edges - An array of edge objects representing the graph edges. Each edge should specify `source` and `target` node IDs, and optionally, a `hidden` property.
 * @param {Object} options - Layout options for the graph.
 * @param {string} options.direction - The layout direction, such as `'LR'` (left-right) or `'TB'` (top-bottom).
 * @returns {{ nodes: any[], edges: any[] }} An object containing the nodes with updated positions and the original edges.
 *
 */
export const getLayoutedElements = (nodes: any[], edges: any[], options: any): { nodes: any[], edges: any[] } => {
  // Set the graph layout direction (e.g., 'LR' for left-right, 'TB' for top-bottom)
  g.setGraph({ rankdir: options.direction });

  // Filter out hidden nodes and edges for the layout computation
  const visibleNodes = nodes.filter((node: any) => !node.hidden);
  const visibleEdges = edges.filter((edge: any) => !edge.hidden);

  // Add edges to the graph based on visible edges
  visibleEdges.forEach((edge: any) => g.setEdge(edge.source, edge.target));

  // Add nodes to the graph based on visible nodes
  visibleNodes.forEach((node: any) => g.setNode(node.id, node));

  // Compute the layout using Dagre's layout algorithm
  Dagre.layout(g);

  // Return the nodes with updated positions (only for visible nodes) and the original edges
  return {
    nodes: nodes.map((node: any) => {
      // Only update the position for visible nodes
      if (!node.hidden) {
        const { x, y } = g.node(node.id);
        return { ...node, position: { x, y } };
      }
      return node;
    }),
    edges,
  };
};
