import { fetchPublishedAssuranceCaseId } from '@/actions/caseStudies'
import { DownloadIcon } from 'lucide-react'
import React from 'react'
import DownloadCaseButton from './DownloadCaseButton'

interface CaseStudyCaseItemProps {
  assuranceCaseId: number
}

const CaseStudyCaseItem = async ({ assuranceCaseId } : CaseStudyCaseItemProps) => {
  const assuranceCase = await fetchPublishedAssuranceCaseId(assuranceCaseId)

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
      <div>
        <DownloadCaseButton content={assuranceCase.content} title={assuranceCase.title} />
      </div>
    </li>
  )
}

export default CaseStudyCaseItem
