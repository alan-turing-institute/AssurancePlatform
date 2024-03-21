import CaseList from '@/components/cases/CaseList'
import NoCasesFound from '@/components/cases/NoCasesFound'
import React from 'react'

const fetchAssuranceCases = async () => {
  return [
    // {
    //   id: 1, 
    //   title: 'Test Case',
    //   description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
    //   created: '01/01/2020'
    // },
    // {
    //   id: 2, 
    //   title: 'Test Case 2',
    //   description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
    //   created: '01/01/2020'
    // },
    // {
    //   id: 3, 
    //   title: 'Test Case 3',
    //   description: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Maxime eius harum, ullam dolorem obcaecati cumque! Alias nostrum eius magnam itaque expedita qui',
    //   created: '01/01/2020'
    // },
  ]
}

const Dashboard = async () => {
  const assuranceCases = await fetchAssuranceCases()

  if(assuranceCases.length === 0 || !assuranceCases) {
    return (
      <>
        <NoCasesFound />
      </>
    )
  }

  return (
    <>
      <CaseList assuranceCases={assuranceCases}/>
    </>
  )
}

export default Dashboard
