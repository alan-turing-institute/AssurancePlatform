'use client'

import React, { Dispatch, useEffect, useState } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { fetchAssuranceCases } from '@/actions/assuranceCases'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { FolderCheckIcon, MoveRightIcon } from 'lucide-react'
import { fetchPublishedAssuranceCaseId } from '@/actions/caseStudies'

interface RelatedAssuranceCaseListProps {
  published: boolean
  selectedAssuranceCases: any[]
  setSelectedAssuranceCases: Dispatch<any>
}

const RelatedAssuranceCaseList = ({ published, selectedAssuranceCases, setSelectedAssuranceCases } : RelatedAssuranceCaseListProps) => {
  const { data } = useSession()
  const [assuranceCasesList, setAssuranceCasesList] = useState<any>([])

  useEffect(() => {
    const getCases = async () => {
      if (published) {
        // Fetch each selected assurance case and update list
        const publishedCases = await Promise.all(
          selectedAssuranceCases.map(async (assuranceCaseId) => {
            return await fetchPublishedAssuranceCaseId(assuranceCaseId)
          })
        )
        setAssuranceCasesList(publishedCases.filter(Boolean)) // Remove any undefined/null values
      } else {
        // Fetch all cases when not published
        const allCases = await fetchAssuranceCases(data?.key!!)
        setAssuranceCasesList(allCases)
      }
    }

    if (selectedAssuranceCases.length > 0 || !published) {
      getCases()
    }
  }, [published, selectedAssuranceCases, data?.key])

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

  if(published) {
    return (
      <ul
        role="list"
        className="divide-y divide-foreground/10 border border-foreground/10 overflow-hidden bg-background shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl mt-4"
      >
        {assuranceCasesList.map((assuranceCase: any) => (
          <li key={assuranceCase.id} className="relative flex justify-between gap-x-6 px-2 py-4 sm:px-6">
            <div className="flex min-w-0 gap-x-4 justify-start items-center">
              <FolderCheckIcon className='size-6'/>
              <div className="min-w-0 flex-auto">
                <p className="text-sm font-semibold text-foreground">
                  {assuranceCase.title}
                </p>
                <p className="flex text-xs text-foreground/50">
                  {assuranceCase.description}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      {assuranceCasesList.length === 0 && (
        <p>No cases found. <Link href={'/dashboard'} className='text-violet-500 inline-flex justify-start items-center gap-2'>Create a New Assurance Case <MoveRightIcon className='size-4' /></Link></p>
      )}
      {assuranceCasesList.length > 0 && (
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
                    <>
                      <div className='flex justify-center items-center gap-2 bg-indigo-900/60 rounded-full py-2 px-3 mr-4 mt-1'>
                        <span className='text-xs text-white'>Selected</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
                <Separator className="my-2" />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  )
}

export default RelatedAssuranceCaseList
