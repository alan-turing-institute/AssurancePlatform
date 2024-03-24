'use client'

import { useState } from 'react';
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
});

function Flow({ assuranceCase }: FlowProps) {
  const { nodes, edges, nodeTypes, onNodesChange, onEdgesChange, onConnect } = useStore(selector, shallow);
  const [editOpen, setEditOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | any>(null)

  // const onConnect = useCallback((params: any ) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleNodeClick = (event: React.MouseEvent, node: Node | any) => {
    setSelectedNode(node)
    setEditOpen(true)
  }

  return (
    <div className='min-h-screen'>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        // onNodesChange={onNodesChange}
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
      <ActionButtons />
      <NodeEdit node={selectedNode} isOpen={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

export default Flow