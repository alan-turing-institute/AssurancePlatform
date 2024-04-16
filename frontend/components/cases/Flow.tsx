'use client'

import { useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background
} from 'reactflow';

import 'reactflow/dist/style.css';
import NodeEdit from '@/components/common/NodeEdit';
import ActionButtons from './ActionButtons';

import { shallow } from 'zustand/shallow';
import useStore from '@/data/store';
import { CloudFog } from 'lucide-react';
import { convertAssuranceCase } from '@/lib/convert-case';

interface FlowProps {
  assuranceCase: any
}

const selector = (state: any) => ({
  nodes: state.nodes,
  edges: state.edges,
  nodeTypes: state.nodeTypes,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  setNodes: state.setNodes,
  setEdges: state.setEdges
});

function Flow({ assuranceCase }: FlowProps) {
  const { nodes, edges, nodeTypes, onNodesChange, onEdgesChange, onConnect, setNodes, setEdges } = useStore(selector, shallow);
  const [editOpen, setEditOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | any>(null)

  const convertCaseIntoNodes = async () => {
    let caseNodes: any = []

    let topGoalNode: any
    let contextNodes: any = []
    let propertyClaimNodes: any = []
    let strategyNodes: any = []
    let evidenceNodes: any = []

    console.log('Case', assuranceCase)
    
    // Should only have one goal per assurance case
    const goal = assuranceCase.goals[0]
    if(goal) {
      // Create Goal Node
      const goalNode = {
        id: crypto.randomUUID(),
        type: 'goal',
        data: { id: goal.id, name: goal.name, type: 'goal', description: goal.short_description, ...goal },
        position: { x: 0, y: 50 },
        hidden: false
      }

      topGoalNode = goalNode
      caseNodes.push(goalNode)

      // loop through contexts if any
      const contexts = assuranceCase.goals[0].context
      if(contexts.length > 0) {
        contexts.map((context: any) => {
          const contextNode = {
            id: context.id.toString(),
            type: 'context',
            data: { name: context.name, type: 'context', description: context.short_description},
            position: { x: -350, y: 50 },
            hidden: false
          }
          contextNodes.push(contextNode)
          caseNodes.push(contextNode)
        })
      }
      
      // loop through strategies if any
      let strategyX = 200;
      let strategyY = 200;
      const strategies = assuranceCase.goals[0].strategies

      if(strategies.length > 0) {
        strategies.map((strategy: any, index: number) => {
          const stragetegyNode = {
            id: strategy.id.toString(),
            type: 'strategy',
            data: { name: strategy.name, type: 'strategy', description: strategy.short_description},
            position: { x: strategyX, y: strategyY },
            hidden: false
          }
          strategyNodes.push(stragetegyNode)
          caseNodes.push(stragetegyNode)
  
          // Double x and y for the next iteration
          strategyX += 400;
        })
      }

      // loop through property claims if any
      let propertyClaimX = -200;
      let propertyClaimY = 200;
      const propertyClaims = assuranceCase.goals[0].property_claims

      if(strategies.length > 0) {
        propertyClaimY = 300;
      }

      if(propertyClaims.length > 0) {
        propertyClaims.map((propertyClaim: any, index: number) => {
          const propertyClaimNode = {
            id: propertyClaim.id.toString(),
            type: 'property',
            data: { name: propertyClaim.name, type: 'property', description: propertyClaim.short_description},
            position: { x: propertyClaimX, y: propertyClaimY },
            hidden: false
          }
          propertyClaimNodes.push(propertyClaimNode)
          caseNodes.push(propertyClaimNode)

          propertyClaimX += 400;
        })
      }

      // loop through evidence if any
    }

    let caseEdges = createEdges(topGoalNode, contextNodes, strategyNodes, propertyClaimNodes)

    return { caseNodes, caseEdges }
  }

  const createEdges = (topGoalNode: any, contextNodes: any[], strategyNodes: any[], propertyClaimNodes: any[]) => {
    let caseEdges: any = []

    // Create Context Edges
    contextNodes.map((cn:any) => {
      const contextGoalEdge = {
        id: 'e1-2',
        source: topGoalNode.id,
        target: cn.id,
        animated: true,
        sourceHandle: 'a',
        hidden: false
      }

      caseEdges.push(contextGoalEdge)
    })

    // Create Property Edges
    propertyClaimNodes.map((pcn:any) => {
      const propertyGoalEdge = {
        id: `el${topGoalNode.id}-${pcn.id}`,
        source: topGoalNode.id,
        target: pcn.id,
        sourceHandle: 'c',
        hidden: false
      }

      caseEdges.push(propertyGoalEdge)
    })

    // Create Strategy Edges
    strategyNodes.map((sn:any) => {
      const stratgeyGoalEdge = {
        id: `el${topGoalNode.id}-${sn.id}`,
        source: topGoalNode.id,
        target: sn.id,
        sourceHandle: 'c',
        hidden: false
      }

      caseEdges.push(stratgeyGoalEdge)
    })

    return caseEdges
  }

  useEffect(() => {
    // convertCaseIntoNodes().then(result => {
    //   setNodes(result.caseNodes)
    //   setEdges(result.caseEdges)
    // })
    convertAssuranceCase(assuranceCase).then(result => {
      console.log(result)
      setNodes(result.caseNodes)
      setEdges(result.caseEdges)
    })
  },[])

  // const onConnect = useCallback((params: any ) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleNodeClick = (event: React.MouseEvent, node: Node | any) => {
    setSelectedNode(node)
    setEditOpen(true)
  }

  const showCreateGoal = (nodes.length > 0 && nodes[0].type === 'goal') ? false : true

  return (
    <div className='min-h-screen'>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        // onEdgesChange={onEdgesChange}
        // onConnect={onConnect}
        className='min-h-screen'
        fitView
        nodeTypes={nodeTypes}
      >
        <MiniMap className='dark:bg-slate-900/10' />
        <Controls className='z-50' />
        <Background/>
      </ReactFlow>
      <ActionButtons showCreateGoal={showCreateGoal} />
      <NodeEdit node={selectedNode} isOpen={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

export default Flow