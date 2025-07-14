import { fetchPublishedAssuranceCaseId } from '@/actions/caseStudies';
import { DownloadIcon } from 'lucide-react';
import React from 'react';
import DownloadCaseButton from './DownloadCaseButton';

interface CaseStudyCaseItemProps {
  assuranceCaseId: string;
}

const CaseStudyCaseItem = async ({
  assuranceCaseId,
}: CaseStudyCaseItemProps) => {
  const publishedAssuranceCase =
    await fetchPublishedAssuranceCaseId(assuranceCaseId);

  return (
    <li
      key={publishedAssuranceCase.id}
      className="relative flex flex-col justify-start gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6 hover:cursor-pointer"
    >
      <div className="flex min-w-0 gap-x-4">
        <div className="min-w-0 flex-auto">
          <p className="text-md font-semibold text-gray-900 mb-2">
            {publishedAssuranceCase.title}
          </p>
          <p className="text-sm text-gray-500">
            {publishedAssuranceCase.description}
          </p>
        </div>
      </div>

      <DownloadCaseButton
        content={publishedAssuranceCase.content}
        title={publishedAssuranceCase.title}
      />
    </li>
  );
};

export default CaseStudyCaseItem;
