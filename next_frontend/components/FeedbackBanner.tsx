import { XMarkIcon } from '@heroicons/react/20/solid'
import { MessageSquareMore } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function FeedbackBanner() {
  const [showBanner, setShowBanner] = useState<boolean>(true)

  if(!showBanner) return null

  return (
    <div className="flex items-center gap-x-6 bg-slate-900 dark:bg-violet-600 px-6 py-2.5 sm:px-3.5 sm:before:flex-1">
      <p className="text-sm leading-6 text-white w-full">
        <Link href="https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/" className='flex flex-col md:flex-row justify-center items-center gap-2 w-full py-3 md:py-0'>
          <div className='flex justify-start items-center gap-2'>
            <MessageSquareMore className='w-4 h-4' />
            <strong className="font-semibold">Feedback</strong>
          </div>
          <svg 
            viewBox="0 0 2 2" 
            className="hidden md:block mx-2 h-0.5 w-0.5 fill-current" 
            aria-hidden="true"
          >
            <circle cx={1} cy={1} r={1} />
          </svg>
          We would love to hear your feedback! &nbsp;<span aria-hidden="true" className='hidden md:block'>&rarr;</span>
        </Link>
      </p>
      <div className="flex flex-1 justify-end">
        <button type="button" className="-m-3 p-3 focus-visible:outline-offset-[-4px]">
          <span className="sr-only">Dismiss</span>
          <XMarkIcon onClick={() => setShowBanner(false)} className="hidden md:block h-5 w-5 text-white" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
