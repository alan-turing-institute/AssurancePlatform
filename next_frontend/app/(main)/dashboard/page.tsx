'use client'

import CaseList from '@/components/cases/CaseList'
import NoCasesFound from '@/components/cases/NoCasesFound'
import { unauthorized, useLoginToken } from '@/hooks/useAuth'
import { useEmailModal } from '@/hooks/useEmailModal'
import { Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const Dashboard = () => {
  const [assuranceCases, setAssuranceCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [tokenChecked, setTokenChecked] = useState(false) // New state to ensure token check is complete
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [token] = useLoginToken();
  const router = useRouter()
  const { data } = useSession()
  const emailModal = useEmailModal();

  const fetchAssuranceCases = async (token: any) => {
    try {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append("Authorization", `Token ${token}`);

      const requestOptions: RequestInit = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases?owner=true&view=false&edit=false&review=false`, requestOptions)

      if(response.status === 401) {
        console.log('Invalid Token')
        localStorage.removeItem('token')
        router.push('login')
        return;
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Failed to fetch assurance cases:", error);
      router.push('login');
    }
  }

  const fetchCurrentUser = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, requestOptions);

    if(response.status === 404 || response.status === 403 ) {
      // TODO: 404 NOT FOUND PAGE
      console.log('Render Not Found Page')
      return
    }

    if(response.status === 401) return unauthorized()

    const result = await response.json()
    return result
  }

  useEffect(() => {
    const storedToken = token || localStorage.getItem('token');

    if(storedToken) {
      fetchAssuranceCases(storedToken).then(result => {
        setAssuranceCases(result)
        setLoading(false)
      })
    } else {
      if (tokenChecked) {
        router.push('login');
      }
    }

    // Set token check to complete
    setTokenChecked(true);
  }, [token, router, tokenChecked])

  useEffect(() => {
    fetchCurrentUser().then(result => {
      setCurrentUser(result)
      if(!result.email) emailModal.onOpen()
    })
  },[])

  return (
    <>
      {loading ? (
        <div className='flex justify-center items-center min-h-screen'>
          <div className='flex flex-col justify-center items-center gap-2'>
            <Loader2 className='w-10 h-10 mt-8 animate-spin' />
            <p className='text-muted-foreground'>Fetching cases...</p>
          </div>
        </div>
      ) : (
        <>
          {assuranceCases.length === 0 ? <NoCasesFound message={'Get started by creating your own assurance case.'} /> : <CaseList assuranceCases={assuranceCases} showCreate />}
        </>
      )}
    </>
  )
}

export default Dashboard
