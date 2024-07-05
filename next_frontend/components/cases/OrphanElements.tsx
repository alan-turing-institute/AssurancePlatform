'use client'

import React, { useEffect, useState } from 'react'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import useStore from '@/data/store'

const OrphanElements = ({ node } : { node: any }) => {
  const { orphanedElements } = useStore();
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<any[]>([])

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

  const handleOrphanSelection = (orphan: any) => {
    alert(`Link to ${orphan.name}`)
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
    </div>
  )
}

export default OrphanElements
