'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import React, { useState } from 'react'
import { Edge, NodeProps, getConnectedEdges, getOutgoers } from 'reactflow'

import { shallow } from 'zustand/shallow';
import useStore from '@/data/store';


interface ToggleButtonProps {
  node: any
}

const selector = (state: any) => ({
  nodes: state.nodes,
  edges: state.edges,
  setNodes: state.setNodes,
  setEdges: state.setEdges
});

const ToggleButton = ({ node } : ToggleButtonProps) => {
  const [hidden, setHidden] = useState<boolean>(true);
  const { nodes, edges, setNodes, setEdges } = useStore(selector, shallow);

  let stack: any[] = []
  let outgoers: any[] = [];
  let connectedEdges: any[] = [];

  const hide = (hidden:boolean , childEdgeID: any, childNodeID: any) => (nodeOrEdge: any) => {
    if (
      childEdgeID.includes(nodeOrEdge.id) ||
      childNodeID.includes(nodeOrEdge.id)
    )
      nodeOrEdge.hidden = hidden;
    return nodeOrEdge;
  };

  const checkTarget = (edge: any, id: number) => {
    let edges = edge.filter((ed: any) => {
      return ed.target !== id;
    });
    return edges;
  };

  const handleToggle = (e:any) => {
    e.stopPropagation();

    let currentNodeID = parseInt(node.id);
    stack.push(node);
    while (stack.length > 0) {
      let lastNOde = stack.pop();
      let childnode = getOutgoers(lastNOde, nodes, edges);
      let childedge = checkTarget(
        getConnectedEdges([lastNOde], edges),
        currentNodeID
      );
      childnode.map((goer, key) => {
        stack.push(goer);
        outgoers.push(goer);
      });
      childedge.map((edge: Edge) => {
        connectedEdges.push(edge);
      });
    }

    let childNodeID = outgoers.map((node) => {
      return node.id;
    });
    let childEdgeID = connectedEdges.map((edge) => {
      return edge.id;
    });

    const updatedNodes = nodes.map((n: any) => {
      if(childNodeID.includes(n.id)) {
        n.hidden = hidden;
      }
      return n
    })

    setNodes(updatedNodes)
    
    // setNodes((n) => n.map(hide(hidden, childEdgeID, childNodeID)));
    // setEdges((e) => e.map(hide(hidden, childEdgeID, childNodeID)));
    setHidden(!hidden);
  }
  
  return (
    <button onClick={(e) => handleToggle(e)}>
      <div className='infline-flex hover:bg-slate-900/10 p-1 rounded-full'>
      {hidden ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
      </div>
    </button>
  )
}

export default ToggleButton
