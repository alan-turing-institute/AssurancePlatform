'use client'

import CaseList from '@/components/cases/CaseList'
import NoCasesFound from '@/components/cases/NoCasesFound'
import { useLoginToken } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const Dashboard = () => {
  // const assuranceCases = await fetchAssuranceCases()

  const [assuranceCases, setAssuranceCases] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState(true)

  // const [token] = useLoginToken();
  const router = useRouter()

  const token = localStorage.getItem("token");

  const fetchAssuranceCases = async (token: any) => {
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
    let token = localStorage.getItem("token");
    console.log('component rendered')

    if(!token) router.push('/login')
    
    setIsLoggedIn(token != null);
    fetchAssuranceCases(token).then(result => {
      setAssuranceCases(result)
      setLoading(false)
    })
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
      {loading ? (
        <div className='flex justify-center items-center'>
          <Loader2 className='w-12 h-12 mt-8 animate-spin' />
        </div>
      ) : (
        <>
          {assuranceCases.length === 0 || !assuranceCases ? <NoCasesFound /> : <CaseList assuranceCases={assuranceCases}/>}
        </>
      )}
    </>
  )
}

export default Dashboard