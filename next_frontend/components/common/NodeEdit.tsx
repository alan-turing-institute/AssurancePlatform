'use client'

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import { CloudFog, Plus, Trash2 } from "lucide-react"
import EditForm from "./EditForm";
import useStore from '@/data/store';
import { Autour_One } from "next/font/google";
import { addEvidenceToClaim, addPropertyClaimToNested, createAssuranceCaseNode, deleteAssuranceCaseNode, setNodeIdentifier } from "@/lib/case-helper";
import { useLoginToken } from "@/hooks/useAuth";
import NewLinkForm from "./NewLinkForm";

interface NodeEditProps {
  node: Node | any
  isOpen: boolean
  onClose: () => void
}

const NodeEdit = ({ node, isOpen, onClose } : NodeEditProps ) => {
  const [isMounted, setIsMounted] = useState(false);
  const { assuranceCase, setAssuranceCase } = useStore();
  const [selectedLink, setSelectedLink] = useState(false)
  const [linkToCreate, setLinkToCreate] = useState('')

  const [token] = useLoginToken();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if(!node) {
    return null
  }

  const selectLink = (type: string) => {
    setSelectedLink(true)
    setLinkToCreate(type)
  }

  /** Function used to handle deletion of the current selected item */
  const handleDelete = async () => {
    const deleted = await deleteAssuranceCaseNode(node.type, node.data.id, token)

    if(deleted) {
      // TODO: Remove node from selected Nodes
      window.location.reload()
    }
  }

  return (
    <EditSheet
      title={`Editing ${node.data.name}`}
      description="Use this form to update your goal."
      isOpen={isOpen} onClose={onClose}
    >
      {selectedLink ? (
        <NewLinkForm node={node} linkType={linkToCreate} actions={{ setLinkToCreate, setSelectedLink, onClose }} />
      ) : (
        <>
        <EditForm node={node} onClose={onClose} />

        {/* Node specific form buttons */}
        {node.type != 'context' && (
          <div className="flex flex-col justify-start items-start mt-8">
            <h3 className="text-lg font-semibold mb-2">Link to {node.data.name}</h3>
            <div className="flex flex-col justify-start items-center gap-4 w-full">
              {node.type === 'goal' && (
                <>
                  <Button variant='outline' onClick={() => selectLink('context')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Context</Button>
                  <Button variant='outline' onClick={() => selectLink('claim')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
                  <Button variant='outline' onClick={() => selectLink('strategy')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Strategy</Button>
                </>
              )}
              {node.type === 'strategy' && (
                  <Button variant='outline' onClick={() => selectLink('claim')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
              )}
              {node.type === 'property' && (
                <>
                  <Button variant='outline' onClick={() => selectLink('evidence')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Evidence</Button>
                  <Button variant='outline' onClick={() => selectLink('claim')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
                </>
              )}
              {node.type === 'evidence' && (
                <>
                  TODO: Property Links
                </>
              )}
            </div>
          </div>
        )}

        {/* Handle Delete */}
        <div className="mt-6">
          <Button variant={'ghost'}
            onClick={handleDelete}
            className="text-red-500 flex justify-center items-center hover:text-red-500 hover:bg-red-400/10"
          >
            <Trash2 className="mr-2"/>
            Delete&nbsp;
            <span className='capitalize'>{node.type}</span></Button>
        </div>
        </>
      )}
    </EditSheet>
  )
}

export default NodeEdit
