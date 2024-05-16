'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import React, { useState } from 'react'
import { Edge, getConnectedEdges, getOutgoers, useReactFlow } from 'reactflow'

import useStore from '@/data/store';


interface ToggleButtonProps {
  node: any
}

const ToggleButton = ({ node } : ToggleButtonProps) => {
  const [hidden, setHidden] = useState<boolean>(true);
  const { nodes, edges, layoutNodes } = useStore();
  const { fitView } = useReactFlow()

  let stack: any[] = []
  let outgoers: any[] = [];
  let connectedEdges: any[] = [];

  const checkTarget = (edge: any, id: number) => {
    let edges = edge.filter((ed: any) => {
      return ed.target !== id;
    });
    return edges;
  };

  const handleToggle = (e:any) => {
    e.stopPropagation();

    let currentNodeID = node.id;
    stack.push(node);

    while (stack.length > 0) {
      let lastNode = stack.pop();
      let childnode = getOutgoers(lastNode, nodes, edges);
      let childedge = checkTarget(
        getConnectedEdges([lastNode], edges),
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

    const updatedEdges = edges.map((n: any) => {
      if(childEdgeID.includes(n.id)) {
        n.hidden = hidden;
      }
      return n
    })

    layoutNodes(updatedNodes, updatedEdges)
    // window.requestAnimationFrame(() => {
    //   fitView();
    // });

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
