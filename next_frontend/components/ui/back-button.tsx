'use client'

import React from 'react'
import { Button } from './button'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

export default function BackButton() {
  const router = useRouter()

  return (
    <Button onClick={() => router.back()} variant={'outline'} className='flex justify-start items-center gap-2 mb-8'><ArrowLeftIcon className='size-4'/>Back</Button>
  )
}
