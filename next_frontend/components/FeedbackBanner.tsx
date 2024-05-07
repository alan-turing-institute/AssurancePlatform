import { XMarkIcon } from '@heroicons/react/20/solid'
import { MessageSquareMore } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function FeedbackBanner() {
  const [showBanner, setShowBanner] = useState<boolean>(true)

  if(!showBanner) return null

  return (
    <div className="flex items-center gap-x-6 bg-violet-600 px-6 py-2.5 sm:px-3.5 sm:before:flex-1">
      <p className="text-sm leading-6 text-white">
        <Link href="/feedback" className='flex justify-start items-center gap-2'>
          <MessageSquareMore className='w-4 h-4' />
          <strong className="font-semibold">Feedback</strong>
          <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
            <circle cx={1} cy={1} r={1} />
          </svg>
          We would love to hear your feedback! &nbsp;<span aria-hidden="true">&rarr;</span>
        </Link>
      </p>
      <div className="flex flex-1 justify-end">
        <button type="button" className="-m-3 p-3 focus-visible:outline-offset-[-4px]">
          <span className="sr-only">Dismiss</span>
          <XMarkIcon onClick={() => setShowBanner(false)} className="h-5 w-5 text-white" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
