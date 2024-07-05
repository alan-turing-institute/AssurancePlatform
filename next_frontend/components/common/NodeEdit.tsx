'use client'

import { Button } from "@/components/ui/button"
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import { CloudFog, Eye, EyeOff, Move, Plus, PlusCircle, Trash2, Unplug } from "lucide-react"
import EditForm from "./EditForm";
import { Autour_One } from "next/font/google";
import { addEvidenceToClaim, addPropertyClaimToNested, createAssuranceCaseNode, deleteAssuranceCaseNode, listPropertyClaims, setNodeIdentifier, updateAssuranceCaseNode, caseItemDescription, updateAssuranceCase, removeAssuranceCaseNode, extractGoalsClaimsStrategies, findElementById, getChildrenHiddenStatus, findSiblingHiddenState, findParentNode, detachCaseElement } from "@/lib/case-helper";
import { useLoginToken } from "@/hooks/useAuth";
import NewLinkForm from "./NewLinkForm";
import { AlertModal } from "../modals/alertModal";
import useStore from '@/data/store';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import OrphanElements from "../cases/OrphanElements";

interface NodeEditProps {
  node: Node | any
  isOpen: boolean
  setEditOpen: Dispatch<SetStateAction<boolean>>
}

const NodeEdit = ({ node, isOpen, setEditOpen }: NodeEditProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const { assuranceCase, setAssuranceCase, nodes, orphanedElements } = useStore();
  const [selectedLink, setSelectedLink] = useState(false)
  const [linkToCreate, setLinkToCreate] = useState('')
  const [unresolvedChanges, setUnresolvedChanges] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggleParentDescription, setToggleParentDescription] = useState(true)
  const [action, setAction] = useState<string | null>(null)
  // const [parentNode, setParentNode] = useState(nodes.filter(n => n.data.id === node.data.goal_id)[0])

  const [selectedClaimMove, setSelectedClaimMove] = useState<any>(null); // State for selected strategy
  const [selectedEvidenceMove, setSelectedEvidenceMove] = useState<any>(null); // State for selected strategy
  const [moveElementType, setMoveElementType] = useState<string | null>(null); // State for selected strategy

  const [token] = useLoginToken();

  let goal: any
  let strategies: any[] = []
  let claims: any[] = []

  if(assuranceCase.goals.length > 0) {
    goal = assuranceCase.goals[0]
    strategies = assuranceCase.goals[0].strategies
    const lookups = extractGoalsClaimsStrategies(assuranceCase.goals)
    claims = lookups.claims
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if (!node) {
    return null
  }

  const selectLink = (type: string) => {
    setSelectedLink(true)
    setLinkToCreate(type)
  }

  /** Function used to handle deletion of the current selected item */
  const handleDelete = async () => {
    setLoading(true)
    const deleted = await deleteAssuranceCaseNode(node.type, node.data.id, token)

    if(deleted) {
      const updatedAssuranceCase = await removeAssuranceCaseNode(assuranceCase, node.data.id)
      if(updatedAssuranceCase) {
          setAssuranceCase(updatedAssuranceCase)
          setLoading(false)
          setDeleteOpen(false)
          handleClose()
          return
      }
    }
  }

  const handleClose = () => {
    setAction(null)
    setEditOpen(false)
    setAlertOpen(false)
    setSelectedLink(false)
    setToggleParentDescription(true)
    setUnresolvedChanges(false)
  }

  const onChange = (open: boolean) => {
    if (unresolvedChanges) {
      setAlertOpen(true)
    } else {
      handleClose()
    }
  };

  const handleMove = async () => {
    setLoading(true)
    if (selectedClaimMove) {
      let updatedItem = null
      console.log(`Move Property to Strategy with ID: ${selectedClaimMove}`);

      // Find id for selected move element
      const type = selectedClaimMove.name.substring(0, 1)
      if (type === 'G') {
        let updateItem = {
          goal_id: goal ? goal.id : null,
          strategy_id: null,
          property_claim_id: null,
          hidden: false
        } as any

        const updated = await updateAssuranceCaseNode('property', node.data.id, token, updateItem)
        // if (updated) {
        //   window.location.reload()
        // }
        if (updated) {
          updateItem.hidden = findSiblingHiddenState(assuranceCase, selectedClaimMove.id)
          const updatedAssuranceCase = await updateAssuranceCase('property', assuranceCase, updateItem, node.data.id, node, true)
          if(updatedAssuranceCase) {
              setAssuranceCase(updatedAssuranceCase)
              setLoading(false)
              // window.location.reload()
              handleClose()
          }
        }
      }
      if (type === 'P') {
        const elementId = claims?.filter((claim: any) => claim.name === selectedClaimMove.name)[0].id

        let updateItem = {
          goal_id: null,
          strategy_id: null,
          property_claim_id: elementId,
          hidden: false
        } as any

        const updated = await updateAssuranceCaseNode('property', node.data.id, token, updateItem)
        // if (updated) {
        //   window.location.reload()
        // }
        if (updated) {
          updateItem.hidden = findSiblingHiddenState(assuranceCase, selectedClaimMove.id)
          const updatedAssuranceCase = await updateAssuranceCase('property', assuranceCase, updateItem, node.data.id, node, true)
          if(updatedAssuranceCase) {
              setAssuranceCase(updatedAssuranceCase)
              setLoading(false)
              // window.location.reload()
              handleClose()
          }
        }
      }
      if (type === 'S') {
        const elementId = strategies?.filter((strategy: any) => strategy.name === selectedClaimMove.name)[0].id

        let updateItem = {
          goal_id: null,
          strategy_id: elementId,
          property_claim_id: null,
          hidden: false
        } as any

        const updated = await updateAssuranceCaseNode('property', node.data.id, token, updateItem)
        // if (updated) {
        //   window.location.reload()
        // }
        if (updated) {
          updateItem.hidden = findSiblingHiddenState(assuranceCase, selectedClaimMove.id)
          const updatedAssuranceCase = await updateAssuranceCase('property', assuranceCase, updateItem, node.data.id, node, true)
          if(updatedAssuranceCase) {
              setAssuranceCase(updatedAssuranceCase)
              setLoading(false)
              // window.location.reload()
              handleClose()
          }
        }
      }
    }
    if (selectedEvidenceMove) {
      console.log(`Move Evidence to Property Claim with ID: ${selectedEvidenceMove}`);
      const updateItem = {
        property_claim_id: [selectedEvidenceMove.id],
        hidden: false
      } as any
      const updated = await updateAssuranceCaseNode('evidence', node.data.id, token, updateItem)
      // if (updated) {
      //   window.location.reload()
      // }
      if (updated) {
        updateItem.hidden = findSiblingHiddenState(assuranceCase, selectedEvidenceMove.id)
        const updatedAssuranceCase = await updateAssuranceCase('evidence', assuranceCase, updateItem, node.data.id, node, true)
        if(updatedAssuranceCase) {
            setAssuranceCase(updatedAssuranceCase)
            setLoading(false)
            // window.location.reload()
            handleClose()
        }
      }
    }
  }

  const parentNode: any = findParentNode(nodes, node)

  const handleDetach = async () => {
    const { detached, error }: any = await detachCaseElement(node.type, node.data.id, token)
    if(error) {
      console.error(error)
    }

    if(detached) {
      const updatedAssuranceCase = await removeAssuranceCaseNode(assuranceCase, node.data.id)
      if(updatedAssuranceCase) {
          setAssuranceCase(updatedAssuranceCase)
          setLoading(false)
          setDeleteOpen(false)
          handleClose()
      }
    }
  }

  return (
    <EditSheet
      title={`Editing ${node.data.name}`}
      description={`Use this form to update your ${caseItemDescription(node.type)}.`}
      isOpen={isOpen}
      onClose={handleClose}
      onChange={onChange}
    >
      {!action && (
        <div>
          {node.type !== 'goal' && parentNode && (
            <div className="mt-6 flex flex-col text-sm">
              <div className="mb-2 flex justify-start items-center gap-2">
                <p>Parent Description</p>
                {toggleParentDescription ?
                (
                  <Eye className="w-4 h-4" onClick={() => setToggleParentDescription(!toggleParentDescription)} />
                ) :
                (
                  <EyeOff className="w-4 h-4" onClick={() => setToggleParentDescription(!toggleParentDescription)} />
                )}
              </div>
              {toggleParentDescription && <p className="text-muted-foreground">{parentNode.data.short_description}</p>}
            </div>
          )}
          <EditForm node={node} onClose={handleClose} setUnresolvedChanges={setUnresolvedChanges} />
          {node.type !== 'context' && (
            <>
              <Separator className="my-6"/>
              <div className="">
                <h3 className="text-lg font-semibold mb-2">Actions</h3>
                <div className="flex flex-col justify-around items-center gap-2">
                  {node.type !== 'context' && node.type !== 'evidence' && (
                    <Button variant={'outline'} onClick={() => setAction('new')} className="w-full"><PlusCircle className="w-4 h-4 mr-2"/>Add New</Button>
                  )}
                  {node.type !== 'context' && node.type !== 'evidence' && (
                    <Button variant={'outline'} onClick={() => setAction('existing')} className="w-full"><Unplug className="w-4 h-4 mr-2"/>Add Existing</Button>
                  )}
                  {node.type !== 'context' && node.type !== 'goal' && node.type !== 'strategy' && (
                    <Button variant={'outline'} onClick={() => setAction('move')} className="w-full"><Move className="w-4 h-4 mr-2"/>Move Item</Button>
                  )}
                </div>
              </div>
              <Separator className="my-6"/>
            </>
          )}
          <div className="mt-12">
            <Button
              variant={"destructive"}
              onClick={() => setDeleteOpen(true)}
              className="w-full flex justify-center items-center"
            >
              <Trash2 className="mr-2" />
              Delete&nbsp;
              <span className='capitalize'>{node.type}</span></Button>
          </div>
          {node.type === 'context' && (
            <Button onClick={handleDetach} className="w-full my-8">Detach</Button>
          )}
        </div>
      )}
      {action === 'new' && (
        selectedLink ? (
          <NewLinkForm node={node} linkType={linkToCreate} actions={{ setLinkToCreate, setSelectedLink, handleClose }} setUnresolvedChanges={setUnresolvedChanges} />
        ) : (
          <>
            {node.type != 'context' && node.type != 'evidence' && (
            <div className="flex flex-col justify-start items-start mt-8">
              <h3 className="text-lg font-semibold mb-2">Add New</h3>
              <div className="flex flex-col justify-start items-center gap-4 w-full">
                {node.type === 'goal' && (
                  <>
                    <Button variant='outline' onClick={() => selectLink('context')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Context</Button>
                    <Button variant='outline' onClick={() => selectLink('strategy')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Strategy</Button>
                    <Button variant='outline' onClick={() => selectLink('claim')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Property Claim</Button>
                  </>
                )}
                {node.type === 'strategy' && (
                    <Button variant='outline' onClick={() => selectLink('claim')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Property Claim</Button>
                )}
                {node.type === 'property' && (
                  <>
                    <Button variant='outline' onClick={() => selectLink('claim')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Property Claim</Button>
                    <Button variant='outline' onClick={() => selectLink('evidence')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Evidence</Button>
                  </>
                )}
              </div>
              <Button
                variant={"outline"}
                onClick={() => setAction(null)}
                className="my-6"
              >
                Cancel
              </Button>
            </div>
          )}
          </>
        )
      )}
      {action === 'existing' && (
        orphanedElements.length > 0 && node.type !== 'evidence' && node.type !== 'context' && (
          <>
            <OrphanElements node={node} />
            <Button
              variant={"outline"}
              onClick={() => setAction(null)}
              className="my-6"
            >
              Cancel
            </Button>
          </>
        )
      )}
      {action === 'move' && (
        <>
        {node.type === 'property' || node.type === 'evidence' ? (
            <div className="w-full pt-4">
              <h3 className="mt-6 text-lg font-semibold mb-2 capitalize">Move {node.type}</h3>
              <div className="flex flex-col justify-start items-left gap-2">
                {node.type === 'property' &&
                  <Select onValueChange={setSelectedClaimMove}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {goal && (
                      <SelectItem key={goal.id} value={goal}>
                        <div className="flex flex-col justify-start items-start gap-1">
                          <div className="flex items-center">
                            <span className="font-medium">{goal.name}</span>
                            <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                              <circle cx={1} cy={1} r={1} />
                            </svg>
                            <span className="max-w-[200px] truncate">{goal.short_description}</span>
                          </div>
                        </div>
                      </SelectItem>
                      )}
                      {strategies?.map((strategy: any) => (
                        <SelectItem key={strategy.id} value={strategy}>
                          <div className="flex justify-start items-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">{strategy.name}</span>
                              <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">{strategy.short_description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                      }
                      {claims && claims.map((claim: any) => (
                        <SelectItem key={claim.id} value={claim}>
                          <div className="flex flex-col justify-start items-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">{claim.name}</span>
                              <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">{claim.short_description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                      }
                      {strategies?.length === 0 && (
                        <SelectItem disabled={true} value="{strategy.id}">
                          No strategies found.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                }
                {node.type === 'evidence' &&
                  <Select onValueChange={setSelectedEvidenceMove}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {claims && claims.map((claim: any) => (
                        <SelectItem key={claim.id} value={claim}>
                          <div className="flex flex-col justify-start items-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">{claim.name}</span>
                              <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">{claim.short_description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                      }
                      {claims && claims.length === 0 && (
                        <SelectItem disabled={true} value="{strategy.id}">
                          No property claims found.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                }

              </div>
            </div>
          ) : null}
          <div className="flex justify-start items-center gap-2">
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
              onClick={handleMove}
            >
              Move
            </Button>
            <Button
              variant={"outline"}
              onClick={() => setAction(null)}
              className="my-6"
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={loading}
        message={'Deleting this element will also remove all of the connected child elements. This cannot be undone.'}
        confirmButtonText={'Yes, delete this element!'}
        cancelButtonText={'No, keep the element'}
      />
      <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={handleClose}
        loading={loading}
        message={'You have changes that have not been updated. Would you like to discard these changes?'}
        confirmButtonText={'Yes, discard changes!'}
        cancelButtonText={'No, keep editing'}
      />
    </EditSheet>
  )
}

export default NodeEdit
