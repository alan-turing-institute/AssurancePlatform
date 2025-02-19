'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { fetchCurrentUser } from '@/actions/users'
import { useSession } from 'next-auth/react'
import { Skeleton } from '../ui/skeleton'

const LoggedInUser = () => {
  const { data } = useSession()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  
  useEffect(() => {
    fetchCurrentUser(data?.key ?? '').then(result => {
      setCurrentUser(result)
      setLoading(false)
    })
  },[])
  
  return (
    <>
      {loading ? (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full aspect-square" />
            <div className="flex flex-col gap-2 w-full">
              <Skeleton className="h-2 w-32" />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
        </div>
      ) : (
        <Link
          href="/dashboard/settings"
          className="group block shrink-0 p-4 rounded-md hover:bg-indigo-900/40 dark:hover:bg-indigo-600"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-indigo-900/40 dark:bg-indigo-500">
              <span className="text-sm font-medium text-white capitalize">{currentUser?.username.charAt(0)}</span>
            </span>
            <div>
              <p className="text-sm font-medium text-white capitalize group-hover:text-white">
                {currentUser?.username}
              </p>
              <p className="text-xs font-medium text-gray-300 group-hover:text-white">
                {currentUser?.email}
              </p>
            </div>
          </div>
        </Link>
      )}
    </>
  )
}

export default LoggedInUser
