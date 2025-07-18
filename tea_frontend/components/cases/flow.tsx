'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  useReactFlow,
} from 'reactflow';

import 'reactflow/dist/style.css';
import { Loader2, Unplug, X } from 'lucide-react';
import NodeEdit, {
  type AssuranceCaseNode,
} from '@/components/common/node-edit';

import useStore from '@/data/store';
import { convertAssuranceCase } from '@/lib/convert-case';
import { getLayoutedElements } from '@/lib/layout-helper';
import ActionButtons from './action-buttons';

import 'react-toastify/dist/ReactToastify.css';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';

function Flow() {
  const { fitView } = useReactFlow();
  const {
    nodes,
    edges,
    nodeTypes,
    onNodesChange,
    setNodes,
    setEdges,
    layoutNodes,
    assuranceCase,
    orphanedElements,
  } = useStore();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOrphanMessage, setShowOrphanMessage] = useState<boolean>(true);

  const { toast } = useToast();

  const onLayout = (direction: 'LR' | 'TB' | 'RL' | 'BT') => {
    const layouted = getLayoutedElements(nodes, edges, { direction });

    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    window.requestAnimationFrame(() => {
      fitView();
    });
  };

  const convert = useCallback(async () => {
    if (assuranceCase) {
      const result = await convertAssuranceCase({
        ...assuranceCase,
        goals: assuranceCase.goals || [],
      });
      const { caseNodes, caseEdges } = result;

      // Send new nodes & edges to layout function
      layoutNodes(caseNodes, caseEdges);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [assuranceCase, layoutNodes]);

  // intial conversion of the assurance case on component render
  useEffect(() => {
    convert();
  }, [convert]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setEditOpen(true);
  };

  const showCreateGoal = !(nodes.length > 0 && nodes[0].type === 'goal');

  const notify = (message: string) => {
    toast({
      description: message,
    });
  };

  const notifyError = (message: string) => {
    toast({
      variant: 'destructive',
      title: 'Uh oh! Something went wrong.',
      description: message,
    });
  };

  const reactFlowWrapper = useRef(null);

  return (
    <div className="min-h-screen">
      {loading ? (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div id="ChartFlow" ref={reactFlowWrapper}>
          <ReactFlow
            className="min-h-screen"
            edges={edges}
            fitView
            id="ReactFlow"
            nodes={nodes}
            nodesDraggable={false}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onNodesChange={onNodesChange}
          >
            <Controls className="z-50" />
            <Background />
          </ReactFlow>
          <ActionButtons
            actions={{ onLayout }}
            notify={notify}
            notifyError={notifyError}
            showCreateGoal={showCreateGoal}
          />
          {selectedNode?.type && (
            <NodeEdit
              isOpen={editOpen}
              node={selectedNode as AssuranceCaseNode}
              setEditOpen={setEditOpen}
            />
          )}
          {orphanedElements &&
            orphanedElements.length > 0 &&
            showOrphanMessage && (
              <div className="absolute top-16 left-0 w-full bg-slate-200/30 px-8 py-2 text-foreground backdrop-blur-sm dark:bg-violet-500/30">
                <div className="flex items-center justify-center">
                  <div className="container mx-auto flex items-center justify-center gap-2">
                    <Unplug className="h-4 w-4" />
                    <p>You have orphaned elements for this assurance case.</p>
                  </div>
                  <Button
                    className="hover:bg-gray-400/10 dark:hover:bg-slate-900/10"
                    onClick={() => setShowOrphanMessage(false)}
                    size={'icon'}
                    variant={'ghost'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default Flow;
