'use client'

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import { CloudFog, Plus, Trash2 } from "lucide-react"
import EditForm from "./EditForm";
import { shallow } from 'zustand/shallow';
import useStore from '@/data/store';

interface NodeEditProps {
  node: Node | any
  isOpen: boolean
  onClose: () => void
}

const selector = (state: any) => ({
  nodes: state.nodes,
  edges: state.edges,
  setNodes: state.setNodes,
  setEdges: state.setEdges
});

const NodeEdit = ({ node, isOpen, onClose } : NodeEditProps ) => {
  const [isMounted, setIsMounted] = useState(false);
  const { nodes, edges, setNodes, setEdges } = useStore(selector, shallow);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if(!node) {
    return null
  }

  const handleContextAdd = async () => {
    let x = node.position.x - 350, y = 50, sourceHandle = 'a'
    // search for other context nodes
    let contextNodes = nodes.filter((node:any) => node.type === 'context')
    
    if(contextNodes.length === 2) {
      return alert('Cannot add more contexts')
    }

    if(contextNodes.length === 1) {
      y = y + 100
    }

    const newContext: any = {
      id: crypto.randomUUID(),
      type: 'context',
      data: { 
        name: 'Test Context', 
        type: 'context', 
        description: 'Text Context Description'
      },
      position: { x, y },
      parent: node.id
    }

    const updatedNodes = [...nodes, newContext]
    setNodes(updatedNodes)

    const contextGoalEdge = {
      id: crypto.randomUUID(),
      source: node.id,
      target: newContext.id,
      animated: true,
      sourceHandle,
      hidden: false,
    }

    const updatedEdges = [...edges, contextGoalEdge]
    setEdges(updatedEdges)
  }

  const handleStrategyAdd = async () => {
    let x = node.position.x - 200, y = node.position.y + 200, level = 0
    let relatedEdges = edges.filter((e:any) => e.source === node.id)

    if(relatedEdges.length > 0) {
      let lastEdge = relatedEdges[relatedEdges.length - 1];
      let lastNode = nodes.filter((node:any) => node.id === lastEdge.target)[0]
      x = lastNode.position.x + 350
    }

    const newStrategy: any = {
      id: crypto.randomUUID(),
      type: 'strategy',
      data: { 
        name: 'Test Strategy', 
        type: 'strategy', 
        description: 'Text Strategy Description'
      },
      position: { x, y },
      parent: node.id,
      level
    }

    console.log('newStrategy', newStrategy)

    const updatedNodes = [...nodes, newStrategy]
    setNodes(updatedNodes)

    const edge = {
      id: crypto.randomUUID(),
      source: node.id,
      target: newStrategy.id,
      sourceHandle: 'c',
      hidden: false
    }

    const updatedEdges = [...edges, edge]
    setEdges(updatedEdges)
  }

  const handleClaimAdd = async () => {
    let x = node.position.x - 200, y = node.position.y + 200, level = 0

    // Check to see if we have strategy nodes
    let strategyNodes = nodes.filter((node:any) => node.type === 'strategy')

    // If strategy nodes, property needs to be to the side and lower
    if(strategyNodes.length > 0) {
      // look for related edges (linked to same parent)
      let relatedEdges = edges.filter((e:any) => e.source === node.id)

      if(relatedEdges.length > 0) {
        let lastEdge = relatedEdges[relatedEdges.length - 1];
        let lastNode = nodes.filter((node:any) => node.id === lastEdge.target)[0]
        x = lastNode.position.x + 350
        // y = y + 100
      }
    }
    
    // search for other property claim nodes
    let propertyNodes = nodes.filter((node:any) => node.type === 'property')
    // If property nodes, then this needs to be added alongside last property
    if(propertyNodes.length > 0) {
      // look for related edges (linked to same parent)
      let relatedEdges = edges.filter((e:any) => e.source === node.id)

      if(relatedEdges.length > 0) {
        let lastEdge = relatedEdges[relatedEdges.length - 1];
        let lastNode = nodes.filter((node:any) => node.id === lastEdge.target)[0]
        x = lastNode.position.x + 350
      }
    }

    if(node.type === 'property' || node.type === 'strategy') {
      level = node.level + 1
    }

    // Update all other nodes on same level moving x axis
    let levelNodes = nodes.filter((node:any) => node.level === level && node.parent !== node.id )
    levelNodes.map((node:any) => {
      if(parent !== node.id) {

        const nodeIndex = nodes.findIndex((n: any) => n.id === node.id);
        if (nodeIndex !== -1) {
          // Make a copy of the nodes array to avoid mutating state directly
          const updatedNodes = [...nodes];

          // Node to move
          console.log(updatedNodes[nodeIndex])

          // ISSUE: Cant seem to update nodes to move

          // // Make changes to the node (for example, updating its data)
          // updatedNodes[nodeIndex] = {
          //   ...updatedNodes[nodeIndex], // Copy the existing node properties
          //   data: {
          //     ...updatedNodes[nodeIndex].data, // Copy the existing node data properties
          //     // Update the specific property you want to change
          //     // For example:
          //     name: 'moved',
          //     description: 'moved'
          //   }
          // };

          // // Update the nodes state in the store with the modified node
          // setNodes(updatedNodes);
        }
      }
    })

    const newClaim: any = {
      id: crypto.randomUUID(),
      type: 'property',
      data: { 
        name: 'Test Property Claim', 
        type: 'property', 
        description: 'Text Property Claim Description'
      },
      position: { x, y },
      parent: node.id,
      level
    }

    console.log('newClaim', newClaim)

    const updatedNodes = [...nodes, newClaim]
    setNodes(updatedNodes)

    const edge = {
      id: crypto.randomUUID(),
      source: node.id,
      target: newClaim.id,
      sourceHandle: 'c',
      hidden: false
    }

    const updatedEdges = [...edges, edge]
    setEdges(updatedEdges)
  }

  return (
    <EditSheet 
      title={`Editing ${node.data.name}`} 
      description="Use this form to update your goal." 
      isOpen={isOpen} onClose={onClose}
    >
      <EditForm node={node} />
      {node.type != 'context' && (
        <div className="flex flex-col justify-start items-start mt-8">
          <h3 className="text-lg font-semibold mb-2">Link to {node.data.name}</h3>
          <div className="flex flex-col justify-start items-center gap-4 w-full">
            {node.type === 'goal' && (
              <>
                <Button variant='outline' onClick={handleContextAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Context</Button>
                <Button variant='outline' onClick={handleClaimAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
                <Button variant='outline' onClick={handleStrategyAdd}className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Strategy</Button>
              </>
            )}
            {node.type === 'strategy' && (
                <Button variant='outline' onClick={handleClaimAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
            )}
            {node.type === 'property' && (
              <>
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Evidence</Button>
                <Button variant='outline' onClick={handleClaimAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
              </>
            )}
            {node.type === 'evidence' && (
              <>
                TODO: Property Links
              </>
            )}
          </div>
        </div>
      )}
      <div className="mt-6">
        <Button variant={'ghost'} 
          className="text-red-500 flex justify-center items-center hover:text-red-500 hover:bg-red-400/10"
        >
          <Trash2 className="mr-2"/>
          Delete&nbsp;
          <span className='capitalize'>{node.type}</span></Button>
      </div>
    </EditSheet>
  )
}

export default NodeEdit
