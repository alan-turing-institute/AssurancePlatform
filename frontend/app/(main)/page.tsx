'use client'

import CaseList from '@/components/cases/CaseList'
import NoCasesFound from '@/components/cases/NoCasesFound'
import { useLoginToken } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const Dashboard = () => {
  // const assuranceCases = await fetchAssuranceCases()

  const [assuranceCases, setAssuranceCases] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true)

  const [token] = useLoginToken();
  const router = useRouter()

  const fetchAssuranceCases = async () => {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Token ${token}`);
  
    var requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };
  
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/`, requestOptions)
    const result = await response.json()
    console.log(result)
    return result
  }    

  useEffect(() => {
    if(token) {
      setIsLoggedIn(token != null);
      fetchAssuranceCases().then(result => {
        setAssuranceCases(result)
        setLoading(false)
      })
    } else {
      router.push('/login')
    }
  },[token])

  // if(assuranceCases.length === 0 || !assuranceCases) {
  //   return (
  //     <>
  //       <NoCasesFound />
  //     </>
  //   )
  // }

  // return (
  //   <>
  //     <CaseList assuranceCases={assuranceCases}/>
  //   </>
  // )

  return (
    <>
      {!isLoggedIn ? (
        <></>
      ) : (
        <>
          {assuranceCases.length === 0 || !assuranceCases ? <NoCasesFound /> : <CaseList assuranceCases={assuranceCases}/>}
        </>
      )}
    </>
  )
}

export default Dashboard
