import React from 'react'
import { ColumnFlow, RowFlow } from '../common/Layouts'
import { Button, Typography } from '@mui/material'
import { PlusIcon } from 'lucide-react'
import CreateCard from './CreateCard'
import CaseCard from './CaseCard'

const fetchAssuranceCases = async () => {
  return [
    {
      id: 1, 
      title: 'Test Case',
      description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
      created: '01/01/2020'
    },
    {
      id: 2, 
      title: 'Test Case 2',
      description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
      created: '01/01/2020'
    },
    {
      id: 3, 
      title: 'Test Case 3',
      description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
      created: '01/01/2020'
    },
  ]
}

const ManageCases = async () => {
  const assuranceCases = await fetchAssuranceCases()
  
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
        {assuranceCases.map((assuranceCase) => (
          <CaseCard key={assuranceCase.id} assuranceCase={assuranceCase} />
        ))}
      </RowFlow>
    </ColumnFlow>
  )
}

export default ManageCases
