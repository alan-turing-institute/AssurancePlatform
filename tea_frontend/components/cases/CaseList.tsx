'use client';

// import { AssuranceCase } from '@/types'
import { ArrowUpTrayIcon } from '@heroicons/react/20/solid';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { useCreateCaseModal } from '@/hooks/useCreateCaseModal';
import { useImportModal } from '@/hooks/useImportModal';
import { Input } from '../ui/input';
import CaseCard from './CaseCard';

interface CaseListProps {
  assuranceCases: any[];
  showCreate?: boolean;
}

const CaseList = ({ assuranceCases, showCreate = false }: CaseListProps) => {
  const createCaseModal = useCreateCaseModal();
  const importModal = useImportModal();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCases, setFilteredCases] = useState(assuranceCases);

  // Set cases with the last created on first
  filteredCases.sort(
    (a, b) =>
      new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  );

  useEffect(() => {
    // Convert searchTerm to lowercase for case-insensitive matching
    const searchTermLowerCase = searchTerm.toLowerCase();
    if (searchTerm.trim() === '') {
      // If searchTerm is empty, show all assurance cases
      setFilteredCases(assuranceCases);
    } else {
      // Filter assurance cases by name containing the searchTerm
      const filtered = assuranceCases.filter((ac: any) =>
        ac.name.toLowerCase().includes(searchTermLowerCase)
      );
      setFilteredCases(filtered);
    }
  }, [searchTerm, assuranceCases]);

  return (
    <div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex w-full items-start justify-between gap-6 py-6">
        <div className="w-2/3 md:w-1/3">
          <Input
            className="w-full"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by name..."
            type="text"
            value={searchTerm}
          />
        </div>
        <div className="flex w-1/3 items-end justify-end">
          <button
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
            onClick={() => importModal.onOpen()}
          >
            <ArrowUpTrayIcon
              aria-hidden="true"
              className="-ml-0.5 h-5 w-5 md:mr-1.5"
            />
            <span className="hidden md:block">Import File</span>
          </button>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {showCreate && (
          <button
            className="group min-h-[420px]"
            onClick={() => createCaseModal.onOpen()}
          >
            <Card className="flex h-full items-center justify-center border-dashed transition-all group-hover:bg-indigo-500/10">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-20">
                <PlusCircleIcon className="group-hover:-translate-y-1 h-10 w-10 transition-all" />
                <div>
                  <h4 className="mb-1 text-center text-xl">Create new case</h4>
                  <p className="text-center text-foreground/70 text-sm">
                    Get started with a new case.
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
        )}
        {filteredCases.map((assuranceCase) => (
          <CaseCard assuranceCase={assuranceCase} key={assuranceCase.id} />
        ))}
      </div>
    </div>
  );
};

export default CaseList;
