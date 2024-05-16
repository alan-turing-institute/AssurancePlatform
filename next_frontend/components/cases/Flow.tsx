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

import useStore from '@/data/store';
import { CloudFog, Loader2 } from 'lucide-react';
import { convertAssuranceCase } from '@/lib/convert-case';
import { getLayoutedElements } from '@/lib/layout-helper';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from 'next-themes';
import { useToast } from '../ui/use-toast';

interface FlowProps {
}

function Flow({ }: FlowProps) {
  const { fitView } = useReactFlow()
  const { nodes, edges, nodeTypes, onNodesChange, onEdgesChange, onConnect, setNodes, setEdges, layoutNodes, assuranceCase } = useStore();
  const [editOpen, setEditOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | any>(null)
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const { toast } = useToast()

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

    // Send new nodes & edges to layout function
    layoutNodes(caseNodes, caseEdges)
    setLoading(false)
  }

  // intial conversion of the assurance case on component render
  useEffect(() => {
    convert()
  },[assuranceCase])

  // const onConnect = useCallback((params: any ) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleNodeClick = (event: React.MouseEvent, node: Node | any) => {
    setSelectedNode(node)
    setEditOpen(true)
  }

  const showCreateGoal = (nodes.length > 0 && nodes[0].type === 'goal') ? false : true

  // const notify = (message: string) => toast.success(message, {
  //   position: "top-right",
  //   autoClose: 5000,
  //   hideProgressBar: false,
  //   closeOnClick: true,
  //   pauseOnHover: true,
  //   draggable: true,
  //   progress: undefined,
  //   theme,
  // });

  const notify = (message: string) => {
    toast({
      // title: "Success",
      description: message,
    })
  }

  const notifyError = (message: string) => {
    toast({
      variant: "destructive",
      title: "Uh oh! Something went wrong.",
      description: message,
    })
  }

  // const notifyError = (message: string) => toast.error(message, {
  //   position: "top-right",
  //   autoClose: 5000,
  //   hideProgressBar: false,
  //   closeOnClick: true,
  //   pauseOnHover: true,
  //   draggable: true,
  //   progress: undefined,
  //   theme,
  // });

  return (
    <div className='min-h-screen'>
      {loading ? (
        <div className='flex justify-center items-center min-h-screen'>
          <Loader2 className='w-8 h-8 animate-spin' />
        </div>
      ) : (
        <div id='ChartFlow'>
          <ReactFlow
            id='ReactFlow'
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
          {/* <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme={theme}
          /> */}
          <ActionButtons
            showCreateGoal={showCreateGoal}
            actions={{ onLayout }}
            notify={notify}
            notifyError={notifyError}
          />
          <NodeEdit node={selectedNode} isOpen={editOpen} onClose={() => setEditOpen(false)} />
        </div>
      )}

    </div>
  );
}

export default Flow
