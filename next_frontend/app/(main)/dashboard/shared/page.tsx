import { fetchSharedAssuranceCases } from '@/actions/assuranceCases'
import CaseList from '@/components/cases/CaseList'
import NoCasesFound from '@/components/cases/NoCasesFound'
import { authOptions } from '@/lib/authOptions'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import React from 'react'

const SharedWithMePage = async () => {
  const session = await getServerSession(authOptions)
  
  // Redirect user to login if no `key`
  if(!session || !session.key) {
    redirect('/login')
  }

  const sharedAssuranceCases = await fetchSharedAssuranceCases(session.key)

  return (
    <>
      {sharedAssuranceCases.length === 0 ?  <NoCasesFound message={'No cases shared with you yet.'} shared /> : <CaseList assuranceCases={sharedAssuranceCases} />}
    </>
  )
}

export default SharedWithMePage
