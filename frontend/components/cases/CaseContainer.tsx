'use client'

import React, { useEffect, useState } from 'react'
import Flow from './Flow'
import { unauthorized, useEnforceLogin, useLoginToken } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '../Header';

const CaseContainer = () => {
  const [assuranceCase, setAssuranceCase] = useState<any>()
  const [loading, setLoading] = useState(true)
  
  const params = useParams()
  const { caseId } = params
  
  const [token] = useLoginToken();
  useEnforceLogin()

  const fetchSingleCase = async (id: number) => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };
  
    const response = await fetch(`http://localhost:8000/api/cases/${id}/`, requestOptions);

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
    //@ts-ignore
    fetchSingleCase(caseId).then(result => {
      setAssuranceCase(result)
      setLoading(false)
    })
  },[])

  return (
    <>
      {loading ? (
        <div className='flex justify-center items-center'>
          <Loader2 className='w-6 h-6 animate-spin' />
        </div>
      ) : (
        assuranceCase ? (
          <>
            <Header assuranceCase={assuranceCase} />
            <Flow assuranceCase={assuranceCase} />
          </>
        ) : (
          <p>No Case Found</p>
        )
      )}
    </>
  )
}

export default CaseContainer
