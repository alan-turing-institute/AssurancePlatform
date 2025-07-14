'use client';

// import { useLoginToken } from '.*/use-auth'
import {
  BookOpenText,
  Database,
  FolderOpenDot,
  Loader2,
  Route,
  Trash,
  Trash2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';
import useStore from '@/data/store';
import {
  addEvidenceToClaim,
  addPropertyClaimToNested,
  attachCaseElement,
  deleteAssuranceCaseNode,
  removeAssuranceCaseNode,
  updateAssuranceCase,
  updateAssuranceCaseNode,
} from '@/lib/case-helper';
import { AlertModal } from '../modals/alertModal';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

type OrphanElementsProps = {
  node: any;
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
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<any[]>(
    []
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  // const [token] = useLoginToken();
  const { data: session } = useSession();

  const filterOrphanElements = async (currentNodeType: string) => {
    switch (currentNodeType.toLowerCase()) {
      case 'goal':
        return orphanedElements;
      case 'strategy':
        return orphanedElements.filter(
          (item: any) => item.type.toLowerCase() === 'propertyclaim'
        );
      case 'property':
        return orphanedElements.filter(
          (item: any) =>
            item.type.toLowerCase() === 'evidence' ||
            item.type.toLowerCase() === 'propertyclaim'
        );
      default:
        return orphanedElements;
    }
  };

  const handleOrphanSelection = async (orphan: any) => {
    setLoading(true);

    const result = await attachCaseElement(
      orphan,
      orphan.id,
      session?.key ?? '',
      node
    );

    if (result.error) {
      // Handle error silently
    }

    if (result.attached) {
      let updatedAssuranceCase;

      switch (orphan.type.toLowerCase()) {
        case 'context': {
          orphan.goal_id = node.data.id;
          // Create a new context array by adding the new context item
          const newContext = [...assuranceCase.goals[0].context, orphan];

          // Create a new assuranceCase object with the updated context array
          updatedAssuranceCase = {
            ...assuranceCase,
            goals: [
              {
                ...assuranceCase.goals[0],
                context: newContext,
              },
            ],
          };

          // Update Assurance Case in state
          setAssuranceCase(updatedAssuranceCase);
          setLoading(false);
          handleClose();
          break;
        }
        case 'strategy': {
          orphan.strategy_id = node.data.id;
          // Create a new strategy array by adding the new context item
          const newStrategy = [...assuranceCase.goals[0].strategies, orphan];

          // Create a new assuranceCase object with the updated strategy array
          updatedAssuranceCase = {
            ...assuranceCase,
            goals: [
              {
                ...assuranceCase.goals[0],
                strategies: newStrategy,
              },
              // Copy other goals if needed
            ],
          };

          // Update Assurance Case in state
          setAssuranceCase(updatedAssuranceCase);
          setLoading(false);
          handleClose();
          break;
        }
        case 'propertyclaim':
          if (node.type === 'goal') {
            orphan.goal_id = node.data.id;
            // TODO: This needs to include the orphaned children also
            // Create a new property claim array by adding the new property claims item
            const newPropertyClaim = [
              ...assuranceCase.goals[0].property_claims,
              orphan,
            ];

            // Create a new assuranceCase object with the updated property claims array
            updatedAssuranceCase = {
              ...assuranceCase,
              goals: [
                {
                  ...assuranceCase.goals[0],
                  property_claims: newPropertyClaim,
                },
              ],
            };

            // Update Assurance Case in state
            setAssuranceCase(updatedAssuranceCase);
            setLoading(false);
            handleClose();
          }
          if (node.type === 'property') {
            orphan.property_claim_id = node.data.id;
            // Call the function to add the new property claim to the nested structure
            const added = addPropertyClaimToNested(
              assuranceCase.goals,
              node.data.id,
              orphan
            );
            if (!added) {
              return; // Parent property claim not found
            }

            const updatedAssuranceCase = {
              ...assuranceCase,
              goals: [
                {
                  ...assuranceCase.goals[0],
                },
              ],
            };

            // const formattedAssuranceCase = await addHiddenProp(updatedAssuranceCase)
            setAssuranceCase(updatedAssuranceCase);
            setLoading(false);
            handleClose();
          }
          if (node.type === 'strategy') {
            orphan.strategy_id = node.data.id;
            // Find the goal containing the specific strategy
            const goalContainingStrategy = assuranceCase.goals.find(
              (goal: any) =>
                goal.strategies &&
                goal.strategies.some(
                  (strategy: any) => strategy.id === node.data.id
                )
            );

            if (goalContainingStrategy) {
              // Clone the assuranceCase to avoid mutating the state directly
              const updatedAssuranceCase = { ...assuranceCase };

              // Update the strategies array in the goal containing the specific strategy
              const updatedStrategies = goalContainingStrategy.strategies.map(
                (strategy: any) => {
                  if (strategy.id === node.data.id) {
                    // Add the new property claim to the corresponding strategy
                    return {
                      ...strategy,
                      property_claims: [...strategy.property_claims, orphan],
                    };
                  }
                  return strategy;
                }
              );

              // Update the goal containing the specific strategy with the updated strategies array
              const updatedGoalContainingStrategy = {
                ...goalContainingStrategy,
                strategies: updatedStrategies,
              };

              // Update the assuranceCase goals array with the updated goal containing the specific strategy
              updatedAssuranceCase.goals = assuranceCase.goals.map(
                (goal: any) => {
                  if (goal === goalContainingStrategy) {
                    return updatedGoalContainingStrategy;
                  }
                  return goal;
                }
              );

              // Update Assurance Case in state
              setAssuranceCase(updatedAssuranceCase);
              setLoading(false);
              handleClose();
            }
          }
          break;
        case 'evidence': {
          orphan.property_claim_id = [node.data.id];
          const added = addEvidenceToClaim(
            assuranceCase.goals,
            node.data.id,
            orphan
          );
          if (!added) {
            return; // Parent property claim not found
          }

          updatedAssuranceCase = {
            ...assuranceCase,
            goals: [
              {
                ...assuranceCase.goals[0],
              },
            ],
          };

          setAssuranceCase(updatedAssuranceCase);
          setLoading(false);
          handleClose();
          break;
        }
        default:
          break;
      }
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Collect all deletion promises
      const deletionPromises = filteredOrphanElements.map(
        async (orphan: any) => {
          const deleted = await deleteAssuranceCaseNode(
            orphan.type,
            orphan.id,
            session?.key ?? ''
          );

          // if (deleted) {
          //     const updatedAssuranceCase = await removeAssuranceCaseNode(assuranceCase, orphan.id);
          //     return updatedAssuranceCase;
          // }

          return { deleted, orphanId: orphan.id };
        }
      );

      // Wait for all deletion promises to resolve
      const deletedResults = await Promise.all(deletionPromises);

      // Extract the ids of the deleted orphans
      const deletedIds = deletedResults
        .filter((result) => result.deleted)
        .map((result) => result.orphanId);

      // Filter out the orphaned elements whose ids are in the deletedIds array
      const updatedOrphanedElements = orphanedElements.filter(
        (item: any) => !deletedIds.includes(item.id)
      );

      // Update state with the filtered orphaned elements
      setOrphanedElements(updatedOrphanedElements);

      setDeleteOpen(false);
      handleClose();
    } catch (error) {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    filterOrphanElements(node.type).then((result) => {
      setFilteredOrphanElements(result);
    });
  }, [node]);

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
          {filteredOrphanElements.map((el: any) => (
            <div key={el.id}>
              <div
                className="flex items-center rounded-md p-2 text-sm hover:cursor-pointer hover:bg-indigo-500"
                onClick={() => handleOrphanSelection(el)}
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
                <span className="w-full truncate">{el.short_description}</span>
              </div>
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
