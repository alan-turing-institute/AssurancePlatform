import { PlusIcon } from '@heroicons/react/20/solid'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'

export default function NoCasesFound() {
  return (
    <div className='flex justify-center items-center min-h-screen px-4 sm:px-6 lg:px-8'>
      <div className="text-center">
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
        <h3 className="mt-2 text-lg font-semibold text-foreground">No Cases Found</h3>
        <p className="mt-1 text-sm text-foreground/80">Get started by creating a new assurance case.</p>
        <div className="mt-6 flex justify-center items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            New Case
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-foreground/5 dark:bg-foreground/10 px-3 py-2 text-sm font-semibold rexr-slate-900 dark:text-white shadow-sm hover:bg-foreground/10 dark:hover:bg-foreground/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <ArrowUpTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Import File
          </button>
        </div>
      </div>
    </div>
  )
}
