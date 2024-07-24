'use client'

import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Edge, getConnectedEdges, getOutgoers, useReactFlow } from 'reactflow'

import useStore from '@/data/store';
import { findSiblingHiddenState, getChildrenHiddenStatus, toggleHiddenForChildren } from '@/lib/case-helper';

interface ToggleButtonProps {
  node: any
}

const ToggleButton = ({ node } : ToggleButtonProps) => {
  const [hidden, setHidden] = useState<boolean>(false);
  const { nodes, edges, layoutNodes, assuranceCase, setAssuranceCase } = useStore();
  const { fitView } = useReactFlow();

  useEffect(() => {
    const currentNode = nodes.find(n => n.id === node.id);

    console.log('CURRENT', currentNode?.data)

    if (currentNode) {
        const { property_claims, strategies } = currentNode.data

        if(property_claims && property_claims.length > 0) {
          setHidden(property_claims[0].hidden)
        }

        if(strategies && strategies.length > 0) {
          setHidden(strategies[0].hidden)
        }
    }
  },[])

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

    // If toggle on Goal node will force focus
    if(node.type === 'goal') {
      window.requestAnimationFrame(() => {
        fitView();
      });
    }

    setHidden(!hidden);
  }

  const handleToggle2 = async (e: any) => {
    e.stopPropagation()

    const currentNode = nodes.find(n => n.id === node.id);
    if (currentNode) {
        // Toggle hidden property for the children of the element with currentNode.data.id
        const updatedAssuranceCase = toggleHiddenForChildren(assuranceCase, currentNode.data.id);
        setAssuranceCase(updatedAssuranceCase);

        if(node.type === 'goal') {
          window.requestAnimationFrame(() => {
            fitView(); 
          })
        }
    }

    setHidden(!hidden)
  }

  return (
    <button onClick={(e) => handleToggle2(e)}>
      <div className='infline-flex hover:bg-slate-900/10 p-1 rounded-full'>
      {hidden ? <ChevronRight size={18}/> : <ChevronDown size={18}/> }
      </div>
    </button>
  )
}

export default ToggleButton
