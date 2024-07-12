
// import Dagre from '@dagrejs/dagre';

// const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

// export const getLayoutedElements = (nodes: any, edges: any, options: any) => {
//   g.setGraph({ rankdir: options.direction });

//   edges.forEach((edge: any) => g.setEdge(edge.source, edge.target));
//   nodes.forEach((node: any) => g.setNode(node.id, node));

//   Dagre.layout(g);

//   return {
//     nodes: nodes.map((node: any) => {
//       const { x, y } = g.node(node.id);
//       return { ...node, position: { x, y } };
//     }),
//     edges,
//   };
// };

import Dagre from '@dagrejs/dagre';

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

export const getLayoutedElements = (nodes: any, edges: any, options: any) => {
  g.setGraph({ rankdir: options.direction });

  // Filter out hidden nodes and edges
  const visibleNodes = nodes.filter((node: any) => !node.hidden);
  const visibleEdges = edges.filter((edge: any) => !edge.hidden);

  visibleEdges.forEach((edge: any) => g.setEdge(edge.source, edge.target));
  visibleNodes.forEach((node: any) => g.setNode(node.id, node));

  Dagre.layout(g);

  return {
    nodes: nodes.map((node: any) => {
      // Only update position for visible nodes
      if (!node.hidden) {
        const { x, y } = g.node(node.id);
        return { ...node, position: { x, y } };
      }
      return node;
    }),
    edges,
  };
};
