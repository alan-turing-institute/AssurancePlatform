'use client'

import React from 'react'
import { Button } from './button'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

interface BackButtonProps {
  url?: string
}

export default function BackButton({ url } : BackButtonProps) {
  const router = useRouter()

  const redirectUrl = url ? url : '/dashboard'

  return (
    <Button onClick={() => router.push(redirectUrl)} variant={'outline'} className='flex justify-start items-center gap-2 mb-8'><ArrowLeftIcon className='size-4'/>Back</Button>
  )
}
