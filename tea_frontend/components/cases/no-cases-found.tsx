'use client';

import { PlusIcon } from '@heroicons/react/20/solid';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCreateCaseModal } from '@/hooks/use-create-case-modal';
import { useImportModal } from '@/hooks/use-import-modal';

type NoCasesFoundProps = {
  message: string;
  shared?: boolean;
};

export default function NoCasesFound({
  message,
  shared = false,
}: NoCasesFoundProps) {
  const createCaseModal = useCreateCaseModal();
  const importModal = useImportModal();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        {shared ? (
          <svg
            aria-label="Shared folder icon"
            className="mx-auto h-12 w-12 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Shared folder</title>
            <path
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
            />
          </svg>
        ) : (
          <svg
            aria-label="Empty folder icon"
            className="mx-auto h-12 w-12 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Empty folder</title>
            <path
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        <h3 className="mt-2 font-semibold text-foreground text-lg">
          No Cases Found
        </h3>
        <p className="mt-1 text-foreground/80 text-sm">{message}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {shared ? (
            <button
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              onClick={() => router.push('/dashboard')}
              type="button"
            >
              <Undo2 aria-hidden="true" className="-ml-0.5 mr-1.5 h-5 w-5" />
              Back to my cases
            </button>
          ) : (
            <>
              <button
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
                onClick={() => createCaseModal.onOpen()}
                type="button"
              >
                <PlusIcon
                  aria-hidden="true"
                  className="-ml-0.5 mr-1.5 h-5 w-5"
                />
                New Case
              </button>
              <button
                className="rexr-slate-900 inline-flex items-center rounded-md bg-foreground/5 px-3 py-2 font-semibold text-sm shadow-sm hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 dark:bg-foreground/10 dark:text-white dark:hover:bg-foreground/20"
                onClick={() => importModal.onOpen()}
                type="button"
              >
                <ArrowUpTrayIcon
                  aria-hidden="true"
                  className="-ml-0.5 mr-1.5 h-5 w-5"
                />
                Import File
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
