'use client'

import { useCreateCaseModal } from '@/hooks/useCreateCaseModal';
import { useImportModal } from '@/hooks/useImportModal';
import { PlusIcon } from '@heroicons/react/20/solid'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type NoCasesFoundProps = {
  message: string
  shared?: boolean
}

export default function NoCasesFound({ message, shared = false } : NoCasesFoundProps) {
  const createCaseModal = useCreateCaseModal();
  const importModal = useImportModal()
  const router = useRouter()

  return (
    <div className='flex justify-center items-center min-h-screen px-4 sm:px-6 lg:px-8'>
      <div className="text-center">
        {!shared ? (
          <svg
            className="mx-auto h-12 w-12 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mx-auto h-12 w-12 text-foreground">
            <path strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
          </svg>
        )}
        <h3 className="mt-2 text-lg font-semibold text-foreground">No Cases Found</h3>
        <p className="mt-1 text-sm text-foreground/80">{message}</p>
        <div className="mt-6 flex justify-center items-center gap-2">
          {!shared ? (
            <>
              <button
                onClick={() => createCaseModal.onOpen()}
                type="button"
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                New Case
              </button>
              <button
                onClick={() => importModal.onOpen()}
                type="button"
                className="inline-flex items-center rounded-md bg-foreground/5 dark:bg-foreground/10 px-3 py-2 text-sm font-semibold rexr-slate-900 dark:text-white shadow-sm hover:bg-foreground/10 dark:hover:bg-foreground/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <ArrowUpTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                Import File
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/dashboard')}
              type="button"
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Undo2 className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              Back to my cases
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
