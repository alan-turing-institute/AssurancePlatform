import React from 'react'
import { DownloadIcon } from 'lucide-react'
import CaseStudyCaseItem from './CaseStudyCaseItem'

interface CaseStudyCasesProps {
  assuranceCaseIds: any[]
}

const CaseStudyCases = ({ assuranceCaseIds } : CaseStudyCasesProps ) => {
  if(assuranceCaseIds.length > 0) {
    return (
      <>
        <h3 className='font-semibold text-lg text-black'>Related Assurance Cases</h3>
        <ul
          role="list"
          className="divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl mt-8 mb-24"
        >
          {assuranceCaseIds.map((assuranceCase) => (
            <CaseStudyCaseItem key={assuranceCase.id} assuranceCaseId={assuranceCase} />
          ))}
        </ul>
      </>
    )
  }

  return null
}

export default CaseStudyCases
