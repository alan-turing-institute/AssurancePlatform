'use client'

import useStore from '@/data/store';
import React, { useEffect } from 'react'

const ActiveUsersList = () => {
  const { activeUsers, setActiveUsers } = useStore();
  console.log(activeUsers)

  useEffect(() => {
    console.log('Compnent remounted')
  }, [activeUsers])

  return (
    <div>
      {activeUsers.map((user: any) => (
        <div className='w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-600 text-emerald-600 text-sm flex justify-center items-center'>
          {user.user.username.substring(0, 1)}
        </div>
      ))}
    </div>
  )
}

export default ActiveUsersList
