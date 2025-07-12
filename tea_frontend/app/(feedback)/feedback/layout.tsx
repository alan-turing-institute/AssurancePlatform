import React, { ReactNode } from 'react'
import { FeedbackForm } from './_components/FeedbackForm'

const FeedbackLayout = ({ children } : { children: ReactNode }) => {
  return (
    <div className='relative bg-grid-paper dark:bg-grid-paper-dark min-h-screen'>
      {/* Your content */}
      <div className='relative z-10 flex justify-center items-center min-h-screen'>
        {/* Your content here */}
        <FeedbackForm />
      </div>
    </div>
  )
}

export default FeedbackLayout
