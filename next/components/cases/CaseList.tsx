import { AssuranceCase } from '@/types'
import { ArrowUpTrayIcon } from '@heroicons/react/20/solid'
import React from 'react'
import CaseCard from './CaseCard'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlusCircleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface CaseListProps {
  assuranceCases: AssuranceCase[]
}

const CaseList = ({ assuranceCases } : CaseListProps) => {
  return (
    <div className='flex flex-col justify-start items-start min-h-screen px-4 sm:px-6 lg:px-8'>
      <div className='w-full flex justify-end items-start py-6'>
        <button
            type="button"
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <ArrowUpTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
             Import File
          </button>
      </div>
      <div className='grid grid-cols-3 gap-4'>
        <Link href={'/'} className='group'>
          <Card className='h-full flex justify-center items-center border-dashed group-hover:bg-indigo-500/10 transition-all'>
            <CardContent className='flex flex-col justify-center items-center gap-2'>
              <PlusCircleIcon className='w-10 h-10 group-hover:-translate-y-1 transition-all' />
              <div>
                <h4 className='text-xl text-center mb-1'>Create new case</h4>
                <p className='text-center text-sm text-foreground/70'>Get started with a new case.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        {assuranceCases.map((assuranceCase) => (
          <CaseCard key={assuranceCase.id} assuranceCase={assuranceCase} />
        ))}
      </div>
    </div>
  )
}

export default CaseList
