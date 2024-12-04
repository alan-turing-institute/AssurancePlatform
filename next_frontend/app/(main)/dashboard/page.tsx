'use client'

import CaseList from '@/components/cases/CaseList'
import NoCasesFound from '@/components/cases/NoCasesFound'
import useStore from '@/data/store'
import { unauthorized, useLoginToken } from '@/hooks/useAuth'
import { useEmailModal } from '@/hooks/useEmailModal'
import { Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const Dashboard = () => {
  const [assuranceCases, setAssuranceCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [tokenChecked, setTokenChecked] = useState(false) // Ensure token check is done
  const [tokenLoaded, setTokenLoaded] = useState(false)   // Ensure token is ready
  const [currentUser, setCurrentUser] = useState<any>(null)

  // const [token] = useLoginToken()
  const router = useRouter()
  const { data: session, status } = useSession() // Get session status
  const emailModal = useEmailModal()

  const fetchAssuranceCases = async () => {
    try {
      const myHeaders = new Headers()
      myHeaders.append("Content-Type", "application/json")
      myHeaders.append("Authorization", `Token ${session?.key}`)

      const requestOptions: RequestInit = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow',
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases?owner=true&view=false&edit=false&review=false`,
        requestOptions
      )

      if (response.status === 401) {
        console.log('Invalid Token')
        localStorage.removeItem('token')
        router.push('login')
        return
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error("Failed to fetch assurance cases:", error)
      router.push('login')
    }
  }

  const fetchCurrentUser = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${session?.key}`,
      },
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, requestOptions)

    if (response.status === 404 || response.status === 403) {
      console.log('Render Not Found Page')
      return
    }

    if (response.status === 401) return unauthorized()

    const result = await response.json()
    return result
  }

  useEffect(() => {
    fetchAssuranceCases().then((result) => {
      setAssuranceCases(result)
      setLoading(false)
    })
  },[])

  // useEffect(() => {
  //   // If the session is loading, do nothing
  //   if (status === 'loading') {
  //     return
  //   }

  //   // Check token availability
  //   const storedToken = token || localStorage.getItem('token')

  //   if (status === 'authenticated' || storedToken) {
  //     // If the session is authenticated or a token is present, proceed with token checks
  //     if (storedToken) {
  //       setTokenLoaded(true) // Mark token as loaded
  //       fetchAssuranceCases(storedToken).then((result) => {
  //         setAssuranceCases(result)
  //         setLoading(false)
  //       })
  //     } else {
  //       if (tokenChecked) {
  //         router.push('login')
  //       }
  //     }
  //     setTokenChecked(true)
  //   } else {
  //     // If the session is unauthenticated or no token is present, redirect to login
  //     router.push('login')
  //   }
  // }, [token, status, router, tokenChecked])

  useEffect(() => {
    fetchCurrentUser().then((result) => {
      setCurrentUser(result)
      if (!result?.email) emailModal.onOpen()
    })
  }, [status])

  return (
    <>
      {loading || status === 'loading' ? (
        <div className='flex justify-center items-center min-h-screen'>
          <div className='flex flex-col justify-center items-center gap-2'>
            <Loader2 className='w-10 h-10 mt-8 animate-spin' />
            <p className='text-muted-foreground'>Fetching cases...</p>
          </div>
        </div>
      ) : (
        <>
          {assuranceCases.length === 0 ? (
            <NoCasesFound message={'Get started by creating your own assurance case.'} />
          ) : (
            <CaseList assuranceCases={assuranceCases} showCreate />
          )}
        </>
      )}
    </>
  )
}

export default Dashboard
