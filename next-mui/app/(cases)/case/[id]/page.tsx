import CaseContainer from '@/components/cases/CaseContainer'
import { assuranceCases } from '@/data'
import { Box } from '@mui/material'
import React from 'react'

const fetchSingleCase = async (id: number) => {
  const assuranceCase = assuranceCases.filter(x => x.id == id)[0]
  return assuranceCase
}

const CasePage = async ({ params } : { params : { id: number }}) => {
  const assuranceCase = await fetchSingleCase(params.id)

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
      <CaseContainer assuranceCase={assuranceCase}/>
    </Box>
  )
}

export default CasePage
