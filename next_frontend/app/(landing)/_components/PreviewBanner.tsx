'use client'

import { XMarkIcon } from '@heroicons/react/20/solid'
import { MessageCircleWarning, MessageSquareMore } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function PreviewBanner() {
  const [showBanner, setShowBanner] = useState<boolean>(true)

  if(!showBanner) return null

  return (
    <div className='fixed bottom-0 left-0 w-full'>
      <div className="flex justify-center items-center gap-x-6 bg-rose-500 px-6 py-4 sm:px-3.5">
        <div className="text-sm leading-6 text-white">
          <Link href="https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/" className='flex justify-start items-center gap-2'>
            <MessageCircleWarning className='hidden md:block w-4 h-4' />
            <div className='flex flex-col md:flex-row justify-start items-start md:items-center gap-2'>
              <strong className="hidden md:block font-semibold">Research Preview</strong>
              <svg viewBox="0 0 2 2" className="hidden md:inline mx-2 h-0.5 w-0.5 fill-current" aria-hidden="true">
                <circle cx={1} cy={1} r={1} />
              </svg>
              <span>As this is <span className='font-bold'>preview only</span> it should not to be used for business critical use cases.</span>
            </div>
          </Link>
        </div>
        {/* <div className="flex flex-1 justify-end">
          <button type="button" className="-m-3 p-3 focus-visible:outline-offset-[-4px]">
            <span className="sr-only">Dismiss</span>
            <XMarkIcon onClick={() => setShowBanner(false)} className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
        </div> */}
      </div>
    </div>
  )
}
