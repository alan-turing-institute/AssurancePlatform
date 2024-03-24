'use client'

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import { Plus, Trash2 } from "lucide-react"
import EditForm from "./EditForm";

interface NodeEditProps {
  node: Node | any
  isOpen: boolean
  onClose: () => void
}

const NodeEdit = ({ node, isOpen, onClose } : NodeEditProps ) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if(!node) {
    return null
  }

  return (
    <EditSheet 
      title={`Editing ${node.data.name}`} 
      description="Use this form to update your goal." 
      isOpen={isOpen} onClose={onClose}
    >
      <EditForm node={node} />
      {node.type != 'context' && (
        <div className="flex flex-col justify-start items-start mt-8">
          <h3 className="text-lg font-semibold mb-2">Link to {node.data.name}</h3>
          <div className="flex flex-col justify-start items-center gap-4 w-full">
            {node.type === 'goal' && (
              <>
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Context</Button>
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Strategy</Button>
              </>
            )}
            {node.type === 'strategy' && (
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
            )}
            {node.type === 'property' && (
              <>
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Evidence</Button>
                <Button variant='outline' className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
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
      <div className="mt-6">
        <Button variant={'ghost'} 
          className="text-red-500 flex justify-center items-center hover:text-red-500 hover:bg-red-400/10"
        >
          <Trash2 className="mr-2"/>
          Delete&nbsp;
          <span className='capitalize'>{node.type}</span></Button>
      </div>
    </EditSheet>
  )
}

export default NodeEdit
