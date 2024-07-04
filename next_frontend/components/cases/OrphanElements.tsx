'use client'

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import useStore from '@/data/store'
import { attachCaseElement, updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'
import { useLoginToken } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

type OrphanElementsProps = {
  node: any
  handleClose: () => void
  loadingState: {
    loading: boolean
    setLoading: Dispatch<SetStateAction<boolean>>
  }
}

const OrphanElements = ({ node, handleClose, loadingState } : OrphanElementsProps) => {
  const { loading, setLoading } = loadingState
  const { orphanedElements, assuranceCase, setAssuranceCase } = useStore();
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<any[]>([])

  const [token] = useLoginToken();

  const filterOrphanElements = async (currentNodeType: string) => {
    switch (currentNodeType.toLowerCase()) {
      case 'goal':
        return orphanedElements
        case 'strategy':
          return orphanedElements.filter((item: any) => item.type === 'claims')
      case 'property':
        return orphanedElements.filter((item: any) => item.type === 'evidence' || item.type === 'claims')
      default:
        return orphanedElements
    }
  }

  const handleOrphanSelection = async (orphan: any) => {
    setLoading(true)
    console.log(`Selected Orphan Element`, orphan)
    const parentId = node.data.id
    orphan.goal_id = parentId

    const result = await attachCaseElement(orphan.type, orphan.id, token, parentId)
    if(result.error) {
      console.error(result.error)
    }
    if(result.attached) {
      console.log('Orphan Attached')
      // Create a new context array by adding the new context item
      const newContext = [...assuranceCase.goals[0].context, orphan];

      // Create a new assuranceCase object with the updated context array
      const updatedAssuranceCase = {
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
            <>
              <div 
                key={el.id} 
                className="p-2 rounded-md text-sm flex items-center hover:bg-indigo-500 hover:cursor-pointer"
                onClick={() => handleOrphanSelection(el)}
              >
                <span className="font-medium">{el.name}</span>
                <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                  <circle cx={1} cy={1} r={1} />
                </svg>
                <span className="w-full truncate">{el.short_description}</span>
              </div>
              <Separator className="my-2" />
            </>
          ))}
        </div>
      </ScrollArea>
      {loading && <p className='flex justify-start items-center mt-4'><Loader2 className='w-4 h-4 mr-2 animate-spin'/>Adding Element...</p>}
    </div>
  )
}

export default OrphanElements
