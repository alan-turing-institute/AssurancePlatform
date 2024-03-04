'use client'

import CaseContainer from '@/components/cases/CaseContainer'
import { assuranceCases } from '@/data'
import { unauthorized, useEnforceLogin, useLoginToken } from '@/hooks/useAuth'
import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const CasePage = ({ params } : { params : { id: number }}) => {
  const [assuranceCase, setAssuranceCase] = useState<any>()

  const [token] = useLoginToken();
  useEnforceLogin()

  const router = useRouter()

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
    fetchSingleCase(params.id).then(result => {
      setAssuranceCase(result)
    })
  },[])

  return (
    <Box
      sx={{
        display: "flex",
        padding: '1rem',
        flexDirection: "row",
        flexShrink: 1,
        flexGrow: 1,
        overflow: "hidden",
        backgroundImage:
          "radial-gradient(circle at 1rem 1rem, #EDF2F7 0.25rem, transparent 0)",
        backgroundSize: "2rem 2rem",
      }}
    >
      {assuranceCase ? (
        <CaseContainer assuranceCase={assuranceCase}/>
      ) : (
        <Typography>Sorry Case Not Found.</Typography>
      )}
    </Box>
  )
}

export default CasePage
