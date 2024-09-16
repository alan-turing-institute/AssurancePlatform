'use client'

// import { AssuranceCase } from '@/types'
import { ArrowUpTrayIcon } from '@heroicons/react/20/solid'
import React, { useEffect, useState } from 'react'
import CaseCard from './CaseCard'

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { useCreateCaseModal } from '@/hooks/useCreateCaseModal'
import { useImportModal } from '@/hooks/useImportModal'
import { useShareModal } from '@/hooks/useShareModal'
import { Input } from '../ui/input'

interface CaseListProps {
  assuranceCases: any[]
  showCreate?: boolean
}

const CaseList = ({ assuranceCases, showCreate = false } : CaseListProps) => {
  const createCaseModal = useCreateCaseModal();
  const importModal = useImportModal();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCases, setFilteredCases] = useState(assuranceCases);

  // Set cases with the last created on first
  //@ts-ignore
  filteredCases.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  useEffect(() => {
    // Convert searchTerm to lowercase for case-insensitive matching
    const searchTermLowerCase = searchTerm.toLowerCase()
    if (searchTerm.trim() === '') {
      // If searchTerm is empty, show all assurance cases
      setFilteredCases(assuranceCases)
    } else {
      // Filter assurance cases by name containing the searchTerm
      const filtered = assuranceCases.filter(
        (ac: any) =>
          ac.name.toLowerCase().includes(searchTermLowerCase)
      );
      setFilteredCases(filtered)
    }
  }, [searchTerm, assuranceCases])

  return (
    <div className='flex flex-col justify-start items-start min-h-screen px-4 sm:px-6 lg:px-8 pb-16'>
      <div className='w-full flex justify-between items-start gap-6 py-6'>
        <div className='w-2/3 md:w-1/3'>
          <Input
            type='text'
            placeholder='Filter by name...'
            className='w-full'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='w-1/3 flex justify-end items-end'>
          <button
              onClick={() => importModal.onOpen()}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
            <ArrowUpTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
             Import File
          </button>
        </div>
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 w-full'>
        {showCreate && (
          <button onClick={() => createCaseModal.onOpen()} className='group min-h-[420px]'>
            <Card className='h-full flex justify-center items-center border-dashed group-hover:bg-indigo-500/10 transition-all'>
              <CardContent className='flex flex-col justify-center items-center gap-2 py-20'>
                <PlusCircleIcon className='w-10 h-10 group-hover:-translate-y-1 transition-all' />
                <div>
                  <h4 className='text-xl text-center mb-1'>Create new case</h4>
                  <p className='text-center text-sm text-foreground/70'>Get started with a new case.</p>
                </div>
              </CardContent>
            </Card>
          </button>
        )}
        {filteredCases.map((assuranceCase) => (
          <CaseCard key={assuranceCase.id} assuranceCase={assuranceCase} />
        ))}
      </div>
    </div>
  )
}

export default CaseList
