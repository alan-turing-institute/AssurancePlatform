'use client'

import React from 'react'
import { Button } from './ui/button'
import { ArrowLeft } from 'lucide-react'
import { ModeToggle } from './ui/theme-toggle'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  assuranceCase: any
}

const Header = ({ assuranceCase } : HeaderProps) => {
  const router = useRouter()

  return (
    <div className='fixed top-0 left-0 bg-indigo-600 dark:bg-slate-900 text-white w-full z-50'>
      <div className='container py-3 flex justify-between items-center'>
        <div className='flex justify-start items-center gap-2'>
          <Button variant={'ghost'} size={'icon'} onClick={() => router.push('/')} className='hover:bg-indigo-900/20 hover:dark:bg-gray-100/10 hover:text-white'><ArrowLeft className='w-4 h-4' /></Button>
          <p className='font-semibold'>{assuranceCase.name}</p>
        </div>
        <ModeToggle className='bg-indigo-500 dark:bg-slate-900 hover:bg-indigo-900/20 hover:dark:bg-gray-100/10 hover:text-white border-none' />
      </div>
    </div>
  )
}

export default Header
