'use client'

import React, { useEffect, useState } from 'react'
import Flow from './Flow'
import { unauthorized, useEnforceLogin, useLoginToken } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '../Header';
import { ReactFlowProvider } from 'reactflow';

import useStore from '@/data/store';
import { addHiddenProp } from '@/lib/case-helper';
import CaseDetails from './CaseDetails';

const CaseContainer = () => {
  // const [assuranceCase, setAssuranceCase] = useState<any>()
  const [loading, setLoading] = useState(true)
  const { assuranceCase, setAssuranceCase, setOrphanedElements } = useStore();
  const [open, setOpen] = useState(false);

  const params = useParams()
  const { caseId } = params

  const [token] = useLoginToken();
  // useEnforceLogin()

  const fetchSingleCase = async (id: number) => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${id}/`, requestOptions);

    if(response.status === 404 || response.status === 403 ) {
      // TODO: 404 NOT FOUND PAGE
      console.log('Render Not Found Page')
      return
    }

    if(response.status === 401) return unauthorized()

    const result = await response.json()

    const formattedAssuranceCase = await addHiddenProp(result)
    return formattedAssuranceCase
  }

  const fetchOrphanedElements = async (id: any) => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${id}/sandbox`, requestOptions);

    if(response.status === 404 || response.status === 403 ) {
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

  useEffect(() => {
    fetchOrphanedElements(caseId).then(result => {
      setOrphanedElements(result)
    })
  },[assuranceCase])

  return (
    <>
      {loading ? (
        <div className='flex justify-center items-center min-h-screen'>
          <div className='flex flex-col justify-center items-center gap-2'>
            <Loader2 className='w-8 h-8 animate-spin' />
            <p className='text-muted-foreground'>Rendering your chart...</p>
          </div>
        </div>
      ) : (
        assuranceCase ? (
          <ReactFlowProvider>
            <Header setOpen={setOpen} />
            <Flow />
            <CaseDetails isOpen={open} setOpen={setOpen} />
          </ReactFlowProvider>
        ) : (
          <p>No Case Found</p>
        )
      )}
    </>
  )
}

export default CaseContainer
