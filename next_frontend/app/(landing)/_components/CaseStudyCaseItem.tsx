import { fetchPublishedAssuranceCaseId } from '@/actions/caseStudies'
import { DownloadIcon } from 'lucide-react'
import React from 'react'

interface CaseStudyCaseItemProps {
  assuranceCaseId: number
}

const CaseStudyCaseItem = async ({ assuranceCaseId } : CaseStudyCaseItemProps) => {
  const assuranceCase = await fetchPublishedAssuranceCaseId(assuranceCaseId)
  console.log(assuranceCase)

  return (
    <li key={assuranceCase.id} className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6 hover:cursor-pointer">
      <div className="flex min-w-0 gap-x-4">
        {/* <img alt="" src={person.imageUrl} className="size-12 flex-none rounded-full bg-gray-50" /> */}
        <div className="min-w-0 flex-auto">
          <p className="text-md font-semibold text-gray-900">
            {assuranceCase.title}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-x-4">
        <p className='text-sm text-muted-foreground'>Download</p>
        <DownloadIcon aria-hidden="true" className="size-5 flex-none text-gray-400" />
      </div>
    </li>
  )
}

export default CaseStudyCaseItem
