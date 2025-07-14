import { DownloadIcon } from 'lucide-react';
import React from 'react';
import CaseStudyCaseItem from './CaseStudyCaseItem';

interface CaseStudyCasesProps {
  assuranceCaseIds: any[];
}

const CaseStudyCases = ({ assuranceCaseIds }: CaseStudyCasesProps) => {
  if (assuranceCaseIds.length > 0) {
    return (
      <>
        <h3 className="font-semibold text-black text-lg">
          Related Assurance Cases
        </h3>
        <ul
          className="mt-8 mb-24 divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl"
          role="list"
        >
          {assuranceCaseIds.map((assuranceCase) => (
            <CaseStudyCaseItem
              assuranceCaseId={assuranceCase}
              key={assuranceCase.id}
            />
          ))}
        </ul>
      </>
    );
  }

  return null;
};

export default CaseStudyCases;
