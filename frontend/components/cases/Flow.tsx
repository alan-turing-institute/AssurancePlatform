'use client'

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Panel,
  useReactFlow
} from 'reactflow';

import 'reactflow/dist/style.css';
import NodeEdit from '@/components/common/NodeEdit';
import ActionButtons from './ActionButtons';

import { shallow } from 'zustand/shallow';
import useStore from '@/data/store';
import { CloudFog, Loader2 } from 'lucide-react';
import { convertAssuranceCase } from '@/lib/convert-case';
import { getLayoutedElements } from '@/lib/layout-helper';

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
  setEdges: state.setEdges,
  layoutNodes: state.layoutNodes
});

function Flow({ assuranceCase }: FlowProps) {
  const { fitView } = useReactFlow()
  const { nodes, edges, nodeTypes, onNodesChange, onEdgesChange, onConnect, setNodes, setEdges, layoutNodes } = useStore(selector, shallow);
  const [editOpen, setEditOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | any>(null)
  const [loading, setLoading] = useState(true)
  const [focus, setFocus] = useState(false)

  const onLayout = (direction: any) => {
    const layouted = getLayoutedElements(nodes, edges, { direction });
  
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  
    window.requestAnimationFrame(() => {
      fitView();
    });
  };

  const convert = async () => {
    const result = await convertAssuranceCase(assuranceCase)
    const { caseNodes, caseEdges } = result

    setNodes(caseNodes);
    setEdges(caseEdges);

    setTimeout(() => {
      layoutNodes()
      setFocus(true)
    }, 0)
  }

  // intial conversion of the assurance case on component render
  useEffect(() => {
    convert()
  },[])

  // Reset focus to get the layouted version of nodes to fitview
  useEffect(() => {
    fitView();
    setLoading(false)
  }, [focus]);
  
  // const onConnect = useCallback((params: any ) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleNodeClick = (event: React.MouseEvent, node: Node | any) => {
    setSelectedNode(node)
    setEditOpen(true)
  }

  const showCreateGoal = (nodes.length > 0 && nodes[0].type === 'goal') ? false : true

  return (
    <div className='min-h-screen'>
      {loading ? (
        <div className='flex justify-center items-center min-h-screen'>
          <Loader2 className='w-8 h-8 animate-spin' />
        </div>
      ) : (
        <>
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
            nodesDraggable={false}
          >
            {/* <MiniMap className='dark:bg-slate-900/10' /> */}
            <Controls className='z-50' />
            <Background/>
          </ReactFlow>
          <ActionButtons showCreateGoal={showCreateGoal} actions={{ onLayout }} />
          <NodeEdit node={selectedNode} isOpen={editOpen} onClose={() => setEditOpen(false)} />
        </>
      )}
      
    </div>
  );
}

export default Flow