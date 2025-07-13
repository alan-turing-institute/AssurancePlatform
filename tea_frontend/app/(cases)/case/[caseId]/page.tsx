import CaseContainer from '@/components/cases/CaseContainer'
import React from 'react'

const AssuranceCasePage = async ({ params } : { params: Promise<{ caseId: string }>}) => {
  const { caseId } = await params
  
  return (
    <CaseContainer />
  )
}

export default AssuranceCasePage
