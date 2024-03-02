'use client'
 
import React, { useEffect, useState } from 'react'
import { ColumnFlow, RowFlow } from '../common/Layouts'
import { Box, Button, CircularProgress, Skeleton, Stack, Typography } from '@mui/material'
import { PlusIcon } from 'lucide-react'
import CreateCard from './CreateCard'
import CaseCard from './CaseCard'
import { assuranceCases } from '@/data'
import { useLoginToken } from '@/hooks/useAuth'

const ManageCases = () => {
  const [assuranceCases, setAssuranceCases] = useState([])
  const [token] = useLoginToken()
  const [loading, setLoading] = useState(true)

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
    return result
  }

  useEffect(() => {
    fetchAssuranceCases().then(result => {
      setAssuranceCases(result)
      setLoading(false)
    })
  },[])
  
  return (
    <ColumnFlow sx={{ overflowY: "auto", gap: "2rem" }}>
      <RowFlow>
        <Typography variant="h1">Assurance Cases</Typography>
        <Button
          sx={{ marginLeft: "auto" }}
          // onClick={onImportClick}
          variant="outlined"
          endIcon={<PlusIcon />}
        >
          Import File
        </Button>
      </RowFlow>
      {/* <CaseCreator isOpen={isOpen} onClose={onClose} isImport={isImport} /> */}
      {/* {error ? <ErrorMessage errors={error} /> : <></>} */}
      {/* TODO split into mine and shared with me */}
      <RowFlow sx={{ flexWrap: "wrap" }}>
        {/* <CreateCard onCreateClick={onCreateClick} /> */}
        <CreateCard />
        {loading ? (
          <Box sx={{ display: 'flex', marginLeft: '1rem' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
          {(assuranceCases.length === 0) ? (
            <Box sx={{ display: 'flex', marginLeft: '1rem' }}>
              <Typography sx={{ color: 'grey' }}>No Cases Found</Typography>
            </Box>
          ) : (
            <>
              {assuranceCases.map((assuranceCase: any) => (
                <CaseCard key={assuranceCase.id} assuranceCase={assuranceCase} />
              ))}
            </>
          )} 
          
          </>
        )}
        
      </RowFlow>
    </ColumnFlow>
  )
}

export default ManageCases
