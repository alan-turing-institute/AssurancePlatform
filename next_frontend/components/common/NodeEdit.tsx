'use client'

import { Button } from "@/components/ui/button"
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import { CloudFog, Plus, Trash2 } from "lucide-react"
import EditForm from "./EditForm";
import useStore from '@/data/store';
import { Autour_One } from "next/font/google";
import { addEvidenceToClaim, addPropertyClaimToNested, createAssuranceCaseNode, deleteAssuranceCaseNode, listPropertyClaims, setNodeIdentifier, updateAssuranceCaseNode, caseItemDescription } from "@/lib/case-helper";
import { useLoginToken } from "@/hooks/useAuth";
import NewLinkForm from "./NewLinkForm";
import { AlertModal } from "../modals/alertModal";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface NodeEditProps {
  node: Node | any
  isOpen: boolean
  setEditOpen: Dispatch<SetStateAction<boolean>>
}

const NodeEdit = ({ node, isOpen, setEditOpen }: NodeEditProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const { assuranceCase, setAssuranceCase } = useStore();
  const [selectedLink, setSelectedLink] = useState(false)
  const [linkToCreate, setLinkToCreate] = useState('')
  const [unresolvedChanges, setUnresolvedChanges] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [selectedClaimMove, setSelectedClaimMove] = useState<string | null>(null); // State for selected strategy
  const [selectedEvidenceMove, setSelectedEvidenceMove] = useState<string | null>(null); // State for selected strategy
  const [moveElementType, setMoveElementType] = useState<string | null>(null); // State for selected strategy

  const [token] = useLoginToken();

  let claims: any[] = []
  let strategies: any[] = []

  if (assuranceCase.goals[0] && node != null) {
    strategies = assuranceCase.goals[0].strategies
    claims = listPropertyClaims(assuranceCase.goals, node.data.name)
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
      setLoading(false)
      window.location.reload()
    }

    //TODO: Throw error is element didnt delete
    // show toast error?
  }

  const handleClose = () => {
    setEditOpen(false)
    setAlertOpen(false)
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
    if (selectedClaimMove) {
      let updatedItem = null
      console.log(`Move Property to Strategy with ID: ${selectedClaimMove}`);

      // Find id for selected move element
      const type = selectedClaimMove.substring(0, 1)
      if (type === 'P') {
        const elementId = claims.filter((claim: any) => claim.name === selectedClaimMove)[0].id

        let updateItem = {
          goal_id: null,
          strategy_id: null,
          property_claim_id: elementId,
        }

        const updated = await updateAssuranceCaseNode('property', node.data.id, token, updateItem)
        if (updated) {
          window.location.reload()
        }
      }
      if (type === 'S') {
        const elementId = strategies.filter((strategy: any) => strategy.name === selectedClaimMove)[0].id

        let updateItem = {
          goal_id: null,
          strategy_id: elementId,
          property_claim_id: null,
        }

        const updated = await updateAssuranceCaseNode('property', node.data.id, token, updateItem)
        if (updated) {
          window.location.reload()
        }

        console.log('Something went wrong updating')
      }

      // const updateItem = {
      //   strategy_id: selectedClaimMove,
      // }
      // const updated = await updateAssuranceCaseNode('property', node.data.id, token, updateItem)
      // if(updated) {
      //   window.location.reload()
      // }
      // console.log('Something went wrong updating')
    }
    if (selectedEvidenceMove) {
      console.log(`Move Evidence to Property Claim with ID: ${selectedEvidenceMove}`);
      const updateItem = {
        property_claim_id: [selectedEvidenceMove],
      }
      const updated = await updateAssuranceCaseNode('evidence', node.data.id, token, updateItem)
      if (updated) {
        window.location.reload()
      }
      console.log('Something went wrong updating')
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
      {selectedLink ? (
        <NewLinkForm node={node} linkType={linkToCreate} actions={{ setLinkToCreate, setSelectedLink, handleClose }} />
      ) : (
        <>
          <EditForm node={node} onClose={handleClose} setUnresolvedChanges={setUnresolvedChanges} />

          {/* Node specific form buttons */}
          {node.type != 'context' && node.type != 'evidence' && (
            <div className="flex flex-col justify-start items-start mt-8">
              <h3 className="text-lg font-semibold mb-2">Link to {node.data.name}</h3>
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
            </div>
          )}

          {/* Moving element options */}
          {node.type === 'property' || node.type === 'evidence' ? (
            <div className="w-full pt-4">
              <h3 className="mt-6 text-lg font-semibold mb-2 capitalize">Move {node.type}</h3>
              <div className="flex justify-start items-center gap-2">
                {node.type === 'property' &&
                  <Select onValueChange={setSelectedClaimMove}> {/* Update state on change */}
                    <SelectTrigger>
                      <SelectValue placeholder="Move to" />
                    </SelectTrigger>
                    <SelectContent>
                      {strategies.map((strategy: any) => (
                        <SelectItem key={strategy.id} value={strategy.name}>
                          <div className="flex flex-col justify-start items-start gap-1">
                            <span className="font-medium">{strategy.name}</span>
                          </div>
                        </SelectItem>
                      ))
                      }
                      {claims && claims.map((claim: any) => (
                        <SelectItem key={claim.id} value={claim.name}>
                          <div className="flex flex-col justify-start items-start gap-1">
                            <span className="font-medium">{claim.name}</span>
                          </div>
                        </SelectItem>
                      ))
                      }
                      {strategies.length === 0 && (
                        <SelectItem disabled={true} value="{strategy.id}">
                          No strategies found.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                }
                {node.type === 'evidence' &&
                  <Select onValueChange={setSelectedEvidenceMove}> {/* Update state on change */}
                    <SelectTrigger>
                      <SelectValue placeholder="Move to" />
                    </SelectTrigger>
                    <SelectContent>
                      {claims && claims.map((claim: any) => (
                        <SelectItem key={claim.id} value={claim.id}>
                          <div className="flex flex-col justify-start items-start gap-1">
                            <span className="font-medium">{claim.name}</span>
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
                <Button variant={"outline"} onClick={handleMove}>Move</Button>
              </div>
            </div>
          ) : null}

          {/* Handle Delete */}
          <div className="mt-12">
            <Button variant={'ghost'}
              onClick={() => setDeleteOpen(true)}
              className="text-red-500 flex justify-center items-center hover:text-red-500 hover:bg-red-400/10"
            >
              <Trash2 className="mr-2" />
              Delete&nbsp;
              <span className='capitalize'>{node.type}</span></Button>
          </div>

          <AlertModal
            isOpen={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={handleDelete}
            loading={loading}
            confirmButtonText={'Delete'}
          />

          <AlertModal
            isOpen={alertOpen}
            onClose={() => setAlertOpen(false)}
            onConfirm={handleClose}
            loading={loading}
            message={'There are unresolved changes, continue to discard these changes.'}
            confirmButtonText={'Discard Changes'}
          />
        </>
      )}
    </EditSheet>
  )
}

export default NodeEdit
