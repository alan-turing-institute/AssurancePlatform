'use client';

import { MoveRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import React, { type Dispatch, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface RelatedAssuranceCaseListProps {
  published: boolean;
  selectedAssuranceCases: any[];
  setSelectedAssuranceCases: Dispatch<any>;
}

const RelatedAssuranceCaseList = ({
  published,
  selectedAssuranceCases,
  setSelectedAssuranceCases,
}: RelatedAssuranceCaseListProps) => {
  const { data } = useSession();
  const [assuranceCasesList, setAssuranceCasesList] = useState<any>([]);

  useEffect(() => {
    const getCases = async () => {
      // if (published) {
      //   // Fetch each selected assurance case and update list
      //   const publishedCases = await Promise.all(
      //     selectedAssuranceCases.map(async (assuranceCaseId) => {
      //       return await fetchPublishedAssuranceCaseId(assuranceCaseId)
      //     })
      //   )
      //   setAssuranceCasesList(publishedCases.filter(Boolean)) // Remove any undefined/null values
      // } else {
      //   // Fetch all cases when not published
      //   // const allCases = await fetchAssuranceCases(data?.key!!)
      //   const allCases = await fetchPublishedAssuranceCases(data?.key!!)
      //   console.log(allCases)
      //   setAssuranceCasesList(allCases)
      // }
      const response = await fetch('/api/published-assurance-cases', {
        headers: {
          Authorization: `Token ${data?.key}`,
        },
      });
      if (response.ok) {
        const allCases = await response.json();
        console.log('ALL PUBLISHED A.CASES', allCases);
        setAssuranceCasesList(allCases);
      }
    };

    getCases();

    // if (selectedAssuranceCases.length > 0 || !published) {
    //   getCases()
    // }
  }, [published, selectedAssuranceCases, data?.key]);

  const handleCaseSelect = (assuranceCaseId: any) => {
    // Toggle the case in selectedAssuranceCases array
    setSelectedAssuranceCases((prevSelected: any) => {
      if (prevSelected.includes(assuranceCaseId)) {
        return prevSelected.filter((id: any) => id !== assuranceCaseId); // Remove it
      }
      return [...prevSelected, assuranceCaseId]; // Add it
    });
  };

  return (
    <>
      {assuranceCasesList.length === 0 && (
        // <p>No cases found. <Link href={'/dashboard'} className='text-violet-500 inline-flex justify-start items-center gap-2'>Create a New Assurance Case <MoveRightIcon className='size-4' /></Link></p>
        <div className="text-center">
          <h3 className="mt-2 font-semibold text-base text-foreground">
            No Published Assurance Cases Found
          </h3>
          <p className="mt-1 text-gray-500 text-sm">
            You need to publish an assurance case first.
          </p>
          <div className="mt-6">
            <Link
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              href={'/dashboard'}
            >
              See Cases
              <MoveRightIcon aria-hidden="true" className="ml-2 size-4" />
            </Link>
          </div>
        </div>
      )}
      {assuranceCasesList.length > 0 && (
        <ScrollArea className="mt-4 h-72 w-full rounded-md border">
          <div className="p-4">
            <h4 className="mb-4 font-normal text-sm leading-none">
              Please select one or more assurance cases.
            </h4>
            {assuranceCasesList
              .sort((a: any, b: any) => {
                const aSelected = selectedAssuranceCases.includes(a.id);
                const bSelected = selectedAssuranceCases.includes(b.id);
                if (aSelected === bSelected) return 0;
                return aSelected ? -1 : 1;
              })
              .map((assuranceCase: any) => (
                <div
                  className={`rounded-md ${selectedAssuranceCases.includes(assuranceCase.id) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'hover:bg-gray-100 dark:hover:bg-slate-900'} hover:cursor-pointer`}
                  key={assuranceCase.id}
                  onClick={() => handleCaseSelect(assuranceCase.id)}
                >
                  <div className="mb-2 flex items-center justify-between p-3">
                    <div className="p-2 text-sm">
                      <p className="font-semibold">
                        {assuranceCase.name || assuranceCase.title}
                      </p>
                      <p
                        className={`text-muted-foreground ${selectedAssuranceCases.includes(assuranceCase.id) ? 'text-white' : ''}`}
                      >
                        {assuranceCase.description !== null
                          ? assuranceCase.description
                          : 'No description'}
                      </p>
                    </div>
                    {selectedAssuranceCases.includes(assuranceCase.id) && (
                      <>
                        <div className="mt-1 mr-4 flex items-center justify-center gap-2 rounded-full bg-indigo-900/60 px-3 py-2">
                          <span className="text-white text-xs">Selected</span>
                          <svg
                            className="size-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              clipRule="evenodd"
                              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                              fillRule="evenodd"
                            />
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
  );
};

export default RelatedAssuranceCaseList;
