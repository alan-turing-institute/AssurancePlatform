'use client'

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import useStore from '@/data/store'
import { addEvidenceToClaim, addPropertyClaimToNested, attachCaseElement, deleteAssuranceCaseNode, removeAssuranceCaseNode, updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'
import { useLoginToken } from '@/hooks/useAuth'
import { BookOpenText, Database, FolderOpenDot, Loader2, Route, Trash, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { AlertModal } from '../modals/alertModal'

type OrphanElementsProps = {
  node: any
  handleClose: () => void
  loadingState: {
    loading: boolean
    setLoading: Dispatch<SetStateAction<boolean>>
  }
  setAction: Dispatch<SetStateAction<string | null>>
}

const OrphanElements = ({ node, handleClose, loadingState, setAction } : OrphanElementsProps) => {
  const { loading, setLoading } = loadingState
  const { orphanedElements, setOrphanedElements, assuranceCase, setAssuranceCase } = useStore();
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<any[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [token] = useLoginToken();

  const filterOrphanElements = async (currentNodeType: string) => {
    switch (currentNodeType.toLowerCase()) {
      case 'goal':
        return orphanedElements
        case 'strategy':
          return orphanedElements.filter((item: any) => item.type.toLowerCase() === 'propertyclaim')
      case 'property':
        return orphanedElements.filter((item: any) => item.type.toLowerCase() === 'evidence' || item.type.toLowerCase() === 'propertyclaim')
      default:
        return orphanedElements
    }
  }

  const handleOrphanSelection = async (orphan: any) => {
    setLoading(true)
    console.log(`Selected Orphan Element`, orphan)

    const result = await attachCaseElement(orphan, orphan.id, token, node)

    if(result.error) {
      console.error(result.error)
    }

    if(result.attached) {
      console.log('Orphan Attached')
      let updatedAssuranceCase

      switch (orphan.type.toLowerCase()) {
        case 'context':
          orphan.goal_id = node.data.id
          // Create a new context array by adding the new context item
          const newContext = [...assuranceCase.goals[0].context, orphan];

          // Create a new assuranceCase object with the updated context array
          updatedAssuranceCase = {
            ...assuranceCase,
            goals: [
              {
                ...assuranceCase.goals[0],
                context: newContext
              }
            ]
          }

          // Update Assurance Case in state
          setAssuranceCase(updatedAssuranceCase)
          setLoading(false)
          handleClose()
          break;
        case 'strategy':
          orphan.strategy_id = node.data.id
          // Create a new strategy array by adding the new context item
          const newStrategy = [...assuranceCase.goals[0].strategies, orphan];

          // Create a new assuranceCase object with the updated strategy array
          updatedAssuranceCase = {
            ...assuranceCase,
            goals: [
              {
                ...assuranceCase.goals[0],
                strategies: newStrategy
              },
              // Copy other goals if needed
            ]
          }

          // Update Assurance Case in state
          setAssuranceCase(updatedAssuranceCase)
          setLoading(false)
          handleClose()
          break;
        case 'propertyclaim':
            if(node.type === 'goal') {
              orphan.goal_id = node.data.id
              // TODO: This needs to include the orphaned children also
              // Create a new property claim array by adding the new property claims item
              const newPropertyClaim = [...assuranceCase.goals[0].property_claims, orphan];

              // Create a new assuranceCase object with the updated property claims array
              updatedAssuranceCase = {
                ...assuranceCase,
                goals: [
                  {
                    ...assuranceCase.goals[0],
                    property_claims: newPropertyClaim
                  },
                ]
              }

              // Update Assurance Case in state
              setAssuranceCase(updatedAssuranceCase)
              setLoading(false)
              handleClose()
            }
            if(node.type === 'property') {
              orphan.property_claim_id = node.data.id
              // Call the function to add the new property claim to the nested structure
              const added = addPropertyClaimToNested(assuranceCase.goals, node.data.id, orphan);
              if (!added) {
                  return console.error("Parent property claim not found!");
              }

              const updatedAssuranceCase = {
                ...assuranceCase,
                goals: [
                  {
                    ...assuranceCase.goals[0],
                  }
                ]
              }

              // const formattedAssuranceCase = await addHiddenProp(updatedAssuranceCase)
              setAssuranceCase(updatedAssuranceCase)
              setLoading(false)
              handleClose()
            }
            if(node.type === 'strategy') {
              orphan.strategy_id = node.data.id
              // Find the goal containing the specific strategy
              const goalContainingStrategy = assuranceCase.goals.find((goal:any) => goal.strategies && goal.strategies.some((strategy:any) => strategy.id === node.data.id));

              if (goalContainingStrategy) {
                // Clone the assuranceCase to avoid mutating the state directly
                const updatedAssuranceCase = { ...assuranceCase };

                // Update the strategies array in the goal containing the specific strategy
                const updatedStrategies = goalContainingStrategy.strategies.map((strategy: any) => {
                  if (strategy.id === node.data.id) {
                    // Add the new property claim to the corresponding strategy
                    return {
                      ...strategy,
                      property_claims: [...strategy.property_claims, orphan]
                    };
                  }
                  return strategy;
                });

                // Update the goal containing the specific strategy with the updated strategies array
                const updatedGoalContainingStrategy = {
                  ...goalContainingStrategy,
                  strategies: updatedStrategies
                };

                // Update the assuranceCase goals array with the updated goal containing the specific strategy
                updatedAssuranceCase.goals = assuranceCase.goals.map((goal: any) => {
                  if (goal === goalContainingStrategy) {
                    return updatedGoalContainingStrategy;
                  }
                  return goal;
                });

                // Update Assurance Case in state
                setAssuranceCase(updatedAssuranceCase);
                setLoading(false)
                handleClose()
              }
            }
          break;
        case 'evidence':
            orphan.property_claim_id = [node.data.id]
            const added = addEvidenceToClaim(assuranceCase.goals, node.data.id, orphan);
            if (!added) {
              return console.error("Parent property claim not found!");
            }

            updatedAssuranceCase = {
              ...assuranceCase,
              goals: [
                {
                  ...assuranceCase.goals[0],
                }
              ]
            }

            setAssuranceCase(updatedAssuranceCase)
            setLoading(false)
            handleClose()
          break;
        default:
          break;
      }
    }
  }

  const handleDelete = async () => {
    setLoading(true);

    try {
        // Collect all deletion promises
        const deletionPromises = filteredOrphanElements.map(async (orphan: any) => {
            const deleted = await deleteAssuranceCaseNode(orphan.type, orphan.id, token);

            // if (deleted) {
            //     const updatedAssuranceCase = await removeAssuranceCaseNode(assuranceCase, orphan.id);
            //     return updatedAssuranceCase;
            // }

            return { deleted, orphanId: orphan.id };
        });

        // Wait for all deletion promises to resolve
        const deletedResults = await Promise.all(deletionPromises);
        console.log('Deleted Results', deletedResults)

        // Extract the ids of the deleted orphans
        const deletedIds = deletedResults
            .filter(result => result.deleted)
            .map(result => result.orphanId);

        // Filter out the orphaned elements whose ids are in the deletedIds array
        const updatedOrphanedElements = orphanedElements.filter((item: any) => !deletedIds.includes(item.id));

        // Update state with the filtered orphaned elements
        setOrphanedElements(updatedOrphanedElements);

        setDeleteOpen(false);
        handleClose();
    } catch (error) {
        console.error("Error during deletion process:", error);
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    filterOrphanElements(node.type).then(result => {
      setFilteredOrphanElements(result)
    })
  }, [node])

  return (
    <div className="flex flex-col justify-start items-start mt-8">
      <h3 className="text-lg font-semibold mb-2">Existing Elements</h3>
      <ScrollArea className={`${filteredOrphanElements.length > 3 ? 'h-80' : 'h-auto'} w-full rounded-md border`}>
        <div className="p-1">
          {filteredOrphanElements.length === 0 && (
              <div
                className="p-2 rounded-md text-sm flex items-center"
              >
                No items found.
              </div>
          )}
          {filteredOrphanElements.map((el: any) => (
            <div key={el.id}>
              <div
                className="p-2 rounded-md text-sm flex items-center hover:bg-indigo-500 hover:cursor-pointer"
                onClick={() => handleOrphanSelection(el)}
              >
                {/* <span className="font-medium">{el.name}</span> */}
                {el.type === 'Evidence' && <Database className='w-6 h-6' />}
                {el.type === 'Strategy' && <Route className='w-6 h-6' />}
                {el.type === 'PropertyClaim' && <FolderOpenDot className='w-6 h-6' />}
                {el.type === 'Context' && <BookOpenText className='w-6 h-6' />}
                <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                  <circle cx={1} cy={1} r={1} />
                </svg>
                <span className="w-full truncate">{el.short_description}</span>
              </div>
              <Separator className="my-2" />
            </div>
          ))}
        </div>
      </ScrollArea>
      {loading && <p className='flex justify-start items-center mt-4'><Loader2 className='w-4 h-4 mr-2 animate-spin'/>Adding Element...</p>}
      <div className='w-full flex justify-start items-center gap-3'>
        <Button
          variant={"outline"}
          onClick={() => setAction(null)}
          className="w-full my-6"
        >
          Cancel
        </Button>
        <Button
          variant={"destructive"}
          onClick={() => setDeleteOpen(true)}
          className="w-full my-6"
        >
          <Trash2 className='w-4 h-4 mr-2'/>Delete All
        </Button>
      </div>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={loading}
        message={'Are you sure you want to delete all orphaned elements. This cannot be undone.'}
        confirmButtonText={'Yes, delete all'}
        cancelButtonText={'No, keep them'}
      />
    </div>
  )
}

export default OrphanElements
