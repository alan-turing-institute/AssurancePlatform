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

  // const fetchAssuranceCases = async () => {
  //   return [
  //     // {
  //     //   id: 1, 
  //     //   title: 'Test Case',
  //     //   description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
  //     //   created: '01/01/2020'
  //     // },
  //     // {
  //     //   id: 2, 
  //     //   title: 'Test Case 2',
  //     //   description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
  //     //   created: '01/01/2020'
  //     // },
  //     // {
  //     //   id: 3, 
  //     //   title: 'Test Case 3',
  //     //   description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
  //     //   created: '01/01/2020'
  //     // },
  //   ]
  // }

  const fetchAssuranceCases = async () => {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Token ${token}`);
  
    var requestOptions: RequestInit = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };
  
    const response = await fetch("http://localhost:8000/api/cases/", requestOptions)
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
