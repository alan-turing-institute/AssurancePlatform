'use client'

import React, { Dispatch, useEffect, useState } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { fetchAssuranceCases } from '@/actions/assuranceCases'
import { useSession } from 'next-auth/react'

interface RelatedAssuranceCaseListProps {
  selectedAssuranceCases: any[]
  setSelectedAssuranceCases: Dispatch<any>
}

const RelatedAssuranceCaseList = ({ selectedAssuranceCases, setSelectedAssuranceCases } : RelatedAssuranceCaseListProps) => {
  const { data } = useSession()
  const [assuranceCasesList, setAssuranceCasesList] = useState<any>([])

  useEffect(() => {
    const getCases = async () => {
      const assuranceCases = await fetchAssuranceCases(data?.key!!)
      return assuranceCases
    }

    getCases().then(result => setAssuranceCasesList(result))
  }, [])

  const handleCaseSelect = (assuranceCaseId: any) => {
    // Toggle the case in selectedAssuranceCases array
    setSelectedAssuranceCases((prevSelected: any) => {
      if (prevSelected.includes(assuranceCaseId)) {
        return prevSelected.filter((id: any) => id !== assuranceCaseId); // Remove it
      } else {
        return [...prevSelected, assuranceCaseId]; // Add it
      }
    });
  };

  return (
    <ScrollArea className="h-72 w-full rounded-md border mt-4">
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium leading-none">Your Assurance Cases</h4>
        {assuranceCasesList.map((assuranceCase: any) => (
          <div 
            key={assuranceCase.id} 
            className={`rounded-md ${selectedAssuranceCases.includes(assuranceCase.id) ? 'bg-indigo-600' : ''}`}
            onClick={() => handleCaseSelect(assuranceCase.id)}
          >
            <div className='flex justify-between items-center'>
              <div className="text-sm p-2">
                <p className='font-semibold'>{assuranceCase.name}</p>
                <p className='text-muted-foreground'>{assuranceCase.description}</p>
              </div>
              {selectedAssuranceCases.includes(assuranceCase.id) && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6 mr-4">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export default RelatedAssuranceCaseList
