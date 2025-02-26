import BackButton from '@/components/ui/back-button'
import PageHeading from '@/components/ui/page-heading'
import { caseStudies } from '@/config'
import moment from 'moment'
import React from 'react'
import CaseStudyForm from '../_components/CaseStudyForm'
import { fetchCaseStudyById } from '@/actions/caseStudies'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'

async function NewCaseStudy({ params } : { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  
  // Redirect user to login if no `key`
  if(!session || !session.key) {
    redirect('/login')
  }

  return (
    <div className='p-8 min-h-screen space-y-4'>
      <BackButton />
      <PageHeading 
        title='New Case Study'
        description={`Use this form to create a case study to showcase your work.`}
      />

      <CaseStudyForm />
    </div>
  )
}

export default NewCaseStudy