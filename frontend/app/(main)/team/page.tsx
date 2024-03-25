import MemberList from '@/components/team/MemberList'
import React from 'react'

const TeamPage = () => {
  return (
    <div className='flex flex-col justify-start items-start min-h-screen px-4 sm:px-6 lg:px-8 pb-16'>
      <div className='pt-6 w-full'>
        <MemberList />
      </div>
    </div>
  )
}

export default TeamPage
