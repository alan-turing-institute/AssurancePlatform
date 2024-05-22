'use client'

import { FolderX, TriangleAlert } from 'lucide-react'
import React from 'react'

const SharedWithMePage = () => {
  return (
    <div className='flex flex-col justify-start items-start min-h-screen px-4 sm:px-6 lg:px-8 pb-16'>
      <div className='pt-12 w-full flex flex-col justify-center items-center gap-4 text-muted-foreground'>
        <TriangleAlert className='w-12 h-12' />
        <p>No cases shared with you</p>
      </div>
    </div>
  )
}

export default SharedWithMePage
