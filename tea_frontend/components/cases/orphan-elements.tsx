'use client';

// import { useLoginToken } from '.*/use-auth'
import {
  BookOpenText,
  Database,
  FolderOpenDot,
  Loader2,
  Route,
  Trash2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';
import type { Node } from 'reactflow';
import useStore from '@/data/store';
import {
  addEvidenceToClaim,
  addPropertyClaimToNested,
  attachCaseElement,
  deleteAssuranceCaseNode,
} from '@/lib/case-helper';
import type { Context, Evidence, PropertyClaim, Strategy } from '@/types';
import { AlertModal } from '../modals/alert-modal';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

type OrphanElement = Context | Evidence | PropertyClaim | Strategy;

type OrphanElementsProps = {
  node: Node;
  handleClose: () => void;
  loadingState: {
    loading: boolean;
    setLoading: Dispatch<SetStateAction<boolean>>;
  };
  setAction: Dispatch<SetStateAction<string | null>>;
};

const OrphanElements = ({
  node,
  handleClose,
  loadingState,
  setAction,
}: OrphanElementsProps) => {
  const { loading, setLoading } = loadingState;
  const {
    orphanedElements,
    setOrphanedElements,
    assuranceCase,
    setAssuranceCase,
  } = useStore();
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<
    OrphanElement[]
  >([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // const [token] = useLoginToken();
  const { data: session } = useSession();

  const filterOrphanElements = React.useCallback(
    (currentNodeType: string): OrphanElement[] => {
      // Convert orphanedElements to OrphanElement[] by mapping to proper types
      const convertedElements = orphanedElements
        .map((item): OrphanElement | null => {
          switch (item.type?.toLowerCase()) {
            case 'context':
              return item as unknown as Context;
            case 'evidence':
              return item as unknown as Evidence;
            case 'propertyclaim':
              return item as unknown as PropertyClaim;
            case 'strategy':
              return item as unknown as Strategy;
            default:
              return null;
          }
        })
        .filter((item): item is OrphanElement => item !== null);

      switch (currentNodeType.toLowerCase()) {
        case 'goal':
          return convertedElements;
        case 'strategy':
          return convertedElements.filter(
            (item) => item.type?.toLowerCase() === 'propertyclaim'
          );
        case 'property':
          return convertedElements.filter(
            (item) =>
              item.type?.toLowerCase() === 'evidence' ||
              item.type?.toLowerCase() === 'propertyclaim'
          );
        default:
          return convertedElements;
      }
    },
    [orphanedElements]
  );

  // Helper functions to break down complexity
  const handleContextAttachment = (orphan: Context) => {
    if (!assuranceCase?.goals || assuranceCase.goals.length === 0) {
      return;
    }
    orphan.goal_id = node.data.id;
    const newContext = [...assuranceCase.goals[0].context, orphan];
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          context: newContext,
        },
      ],
    };
    setAssuranceCase(updatedAssuranceCase);
    setLoading(false);
    handleClose();
  };

  const handleStrategyAttachment = (orphan: Strategy) => {
    if (!assuranceCase?.goals || assuranceCase.goals.length === 0) {
      return;
    }
    orphan.goal_id = node.data.id;
    const newStrategy = [...assuranceCase.goals[0].strategies, orphan];
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          strategies: newStrategy,
        },
      ],
    };
    setAssuranceCase(updatedAssuranceCase);
    setLoading(false);
    handleClose();
  };

  const handlePropertyClaimToGoal = (orphan: PropertyClaim) => {
    if (!assuranceCase?.goals || assuranceCase.goals.length === 0) {
      return;
    }
    orphan.goal_id = node.data.id;
    const newPropertyClaim = [
      ...assuranceCase.goals[0].property_claims,
      orphan,
    ];
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          property_claims: newPropertyClaim,
        },
      ],
    };
    setAssuranceCase(updatedAssuranceCase);
    setLoading(false);
    handleClose();
  };

  const handlePropertyClaimToProperty = (orphan: PropertyClaim) => {
    if (!assuranceCase?.goals) {
      return;
    }
    orphan.property_claim_id = node.data.id;
    const added = addPropertyClaimToNested(
      assuranceCase.goals as unknown as PropertyClaim[],
      node.data.id,
      orphan
    );
    if (!added) {
      return;
    }
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: assuranceCase.goals,
    };
    setAssuranceCase(updatedAssuranceCase);
    setLoading(false);
    handleClose();
  };

  const handlePropertyClaimToStrategy = (orphan: PropertyClaim) => {
    if (!assuranceCase?.goals) {
      return;
    }
    orphan.strategy_id = node.data.id;
    const goalContainingStrategy = assuranceCase.goals.find((goal) =>
      goal.strategies?.some((strategy) => strategy.id === node.data.id)
    );

    if (goalContainingStrategy) {
      const updatedAssuranceCase = { ...assuranceCase };
      const updatedStrategies = goalContainingStrategy.strategies.map(
        (strategy) => {
          if (strategy.id === node.data.id) {
            return {
              ...strategy,
              property_claims: [...strategy.property_claims, orphan],
            };
          }
          return strategy;
        }
      );

      const updatedGoalContainingStrategy = {
        ...goalContainingStrategy,
        strategies: updatedStrategies,
      };

      updatedAssuranceCase.goals = (assuranceCase.goals || []).map((goal) => {
        if (goal === goalContainingStrategy) {
          return updatedGoalContainingStrategy;
        }
        return goal;
      });

      setAssuranceCase(updatedAssuranceCase);
      setLoading(false);
      handleClose();
    }
  };

  const handleEvidenceAttachment = (orphan: Evidence) => {
    if (!assuranceCase?.goals) {
      return;
    }
    orphan.property_claim_id = [node.data.id];
    const added = addEvidenceToClaim(
      assuranceCase.goals as unknown as PropertyClaim[],
      node.data.id,
      orphan
    );
    if (!added) {
      return; // Parent property claim not found
    }

    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: assuranceCase.goals,
    };

    setAssuranceCase(updatedAssuranceCase);
    setLoading(false);
    handleClose();
  };

  const handlePropertyClaimAttachment = (orphan: PropertyClaim) => {
    if (node.type === 'goal') {
      handlePropertyClaimToGoal(orphan);
    } else if (node.type === 'property') {
      handlePropertyClaimToProperty(orphan);
    } else if (node.type === 'strategy') {
      handlePropertyClaimToStrategy(orphan);
    }
  };

  // Helper function to convert OrphanElement to ReactFlowNode format
  const convertToReactFlowNode = (orphan: OrphanElement) => ({
    id: orphan.id.toString(),
    type: orphan.type || '',
    position: { x: 0, y: 0 },
    data: {
      id: orphan.id,
      name: orphan.name,
      type: orphan.type || '',
      short_description:
        'short_description' in orphan ? orphan.short_description : '',
      long_description:
        'long_description' in orphan ? orphan.long_description : '',
      goal_id: 'goal_id' in orphan ? orphan.goal_id : null,
      strategy_id: 'strategy_id' in orphan ? orphan.strategy_id : null,
      property_claim_id:
        'property_claim_id' in orphan ? orphan.property_claim_id : null,
    },
  });

  // Helper function to handle orphan attachment based on type
  const processOrphanAttachment = (orphan: OrphanElement) => {
    switch (orphan.type?.toLowerCase()) {
      case 'context':
        handleContextAttachment(orphan as Context);
        break;
      case 'strategy':
        handleStrategyAttachment(orphan as Strategy);
        break;
      case 'propertyclaim':
        handlePropertyClaimAttachment(orphan as PropertyClaim);
        break;
      case 'evidence':
        handleEvidenceAttachment(orphan as Evidence);
        break;
      default:
        setLoading(false);
        break;
    }
  };

  const handleOrphanSelection = async (orphan: OrphanElement) => {
    setLoading(true);

    const orphanAsReactFlowNode = convertToReactFlowNode(orphan);

    const result = await attachCaseElement(
      orphanAsReactFlowNode,
      orphan.id,
      session?.key ?? '',
      {
        id: node.id,
        type: node.type || '',
        position: { x: 0, y: 0 },
        data: node.data,
      }
    );

    if ('error' in result && result.error) {
      setLoading(false);
      return;
    }

    if ('attached' in result && !result.attached) {
      setLoading(false);
      return;
    }

    processOrphanAttachment(orphan);
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Collect all deletion promises
      const deletionPromises = filteredOrphanElements.map(async (orphan) => {
        const deleted = await deleteAssuranceCaseNode(
          orphan.type ?? '',
          orphan.id,
          session?.key ?? ''
        );

        // if (deleted) {
        //     const updatedAssuranceCase = await removeAssuranceCaseNode(assuranceCase, orphan.id);
        //     return updatedAssuranceCase;
        // }

        return { deleted, orphanId: orphan.id };
      });

      // Wait for all deletion promises to resolve
      const deletedResults = await Promise.all(deletionPromises);

      // Extract the ids of the deleted orphans
      const deletedIds = deletedResults
        .filter((result) => result.deleted)
        .map((result) => result.orphanId);

      // Filter out the orphaned elements whose ids are in the deletedIds array
      const updatedOrphanedElements = orphanedElements.filter(
        (item) => !deletedIds.includes(item.id)
      );

      // Update state with the filtered orphaned elements
      setOrphanedElements(updatedOrphanedElements);

      setDeleteOpen(false);
      handleClose();
    } catch (_error) {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const result = filterOrphanElements(node.type || '');
    setFilteredOrphanElements(result);
  }, [node.type, filterOrphanElements]);

  return (
    <div className="mt-8 flex flex-col items-start justify-start">
      <h3 className="mb-2 font-semibold text-lg">Existing Elements</h3>
      <ScrollArea
        className={`${filteredOrphanElements.length > 3 ? 'h-80' : 'h-auto'} w-full rounded-md border`}
      >
        <div className="p-1">
          {filteredOrphanElements.length === 0 && (
            <div className="flex items-center rounded-md p-2 text-sm">
              No items found.
            </div>
          )}
          {filteredOrphanElements.map((el) => (
            <div key={el.id}>
              <button
                className="flex w-full items-center rounded-md p-2 text-sm hover:cursor-pointer hover:bg-indigo-500"
                onClick={() => handleOrphanSelection(el)}
                type="button"
              >
                {/* <span className="font-medium">{el.name}</span> */}
                {el.type === 'Evidence' && <Database className="h-6 w-6" />}
                {el.type === 'Strategy' && <Route className="h-6 w-6" />}
                {el.type === 'PropertyClaim' && (
                  <FolderOpenDot className="h-6 w-6" />
                )}
                {el.type === 'Context' && <BookOpenText className="h-6 w-6" />}
                <svg
                  aria-hidden="true"
                  className="mx-2 inline h-0.5 w-0.5 fill-current"
                  viewBox="0 0 2 2"
                >
                  <circle cx={1} cy={1} r={1} />
                </svg>
                <span className="w-full truncate">
                  {(() => {
                    if (
                      'short_description' in el &&
                      typeof el.short_description === 'string'
                    ) {
                      return el.short_description;
                    }
                    if ('name' in el && typeof el.name === 'string') {
                      return el.name;
                    }
                    return '';
                  })()}
                </span>
              </button>
              <Separator className="my-2" />
            </div>
          ))}
        </div>
      </ScrollArea>
      {loading && (
        <p className="mt-4 flex items-center justify-start">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Adding Element...
        </p>
      )}
      <div className="flex w-full items-center justify-start gap-3">
        <Button
          className="my-6 w-full"
          onClick={() => setAction(null)}
          variant={'outline'}
        >
          Cancel
        </Button>
        <Button
          className="my-6 w-full"
          onClick={() => setDeleteOpen(true)}
          variant={'destructive'}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete All
        </Button>
      </div>
      <AlertModal
        cancelButtonText={'No, keep them'}
        confirmButtonText={'Yes, delete all'}
        isOpen={deleteOpen}
        loading={loading}
        message={
          'Are you sure you want to delete all orphaned elements. This cannot be undone.'
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default OrphanElements;
