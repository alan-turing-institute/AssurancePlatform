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
  const { fitView } = useReactFlow();

  const checkTarget = (edge: any, id: number) => {
    let edges = edge.filter((ed: any) => {
      return ed.target !== id;
    });
    return edges;
  };

  const handleToggle = (e: any) => {
    e.stopPropagation();

    let currentNodeID = node.id;
    let stack = [node];
    let outgoersSet = new Set();
    let connectedEdgesSet = new Set();
    let allDescendantsSet = new Set();

    if (!hidden) {
        // Traverse to hide all children and their descendants
        while (stack.length > 0) {
            let lastNode = stack.pop();
            let childNodes = getOutgoers(lastNode, nodes, edges);
            let childEdges = checkTarget(
                getConnectedEdges([lastNode], edges),
                currentNodeID
            );

            childNodes.forEach((goer) => {
                stack.push(goer);
                allDescendantsSet.add(goer.id);
            });

            childEdges.forEach((edge: any) => {
                connectedEdgesSet.add(edge.id);
            });
        }
    } else {
        // Identify direct children to show
        let childNodes = getOutgoers(node, nodes, edges);
        let childEdges = checkTarget(
            getConnectedEdges([node], edges),
            currentNodeID
        );

        childNodes.forEach((goer) => {
            outgoersSet.add(goer.id);
        });

        childEdges.forEach((edge: any) => {
            connectedEdgesSet.add(edge.id);
        });
    }

    // Ensure the selected node is never hidden
    outgoersSet.delete(currentNodeID);
    allDescendantsSet.delete(currentNodeID);

    const updatedNodes = nodes.map((n) => {
        if (n.id === currentNodeID) {
            // Ensure the selected node is always visible
            return { ...n, hidden: false };
        } else if (outgoersSet.has(n.id)) {
            // Show direct children when toggling to show
            return { ...n, hidden: false };
        } else if (allDescendantsSet.has(n.id)) {
            // Hide all descendants when toggling to hide
            return { ...n, hidden: true };
        }
        return n;
    });

    const updatedEdges = edges.map((e) => {
        if (connectedEdgesSet.has(e.id)) {
            // Toggle visibility of edges connected to direct children or descendants
            return { ...e, hidden: !hidden };
        }
        return e;
    });

    layoutNodes(updatedNodes, updatedEdges);
    window.requestAnimationFrame(() => {
        fitView();
    });

    setHidden(!hidden);
  }

  return (
    <button onClick={(e) => handleToggle(e)}>
      <div className='infline-flex hover:bg-slate-900/10 p-1 rounded-full'>
      {hidden ? <ChevronUp size={18}/> : <ChevronDown size={18}/> }
      </div>
    </button>
  )
}

export default ToggleButton
