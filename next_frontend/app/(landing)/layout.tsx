import React from 'react'
import PreviewBanner from './_components/PreviewBanner'
import Header from './_components/Header'

const LandingLayout = ({ children } : { children: React.ReactNode }) => {
  return (
    <div className='min-h-screen bg-white'>
      <Header />
      {children}
      <PreviewBanner />
    </div>
  )
}

export default LandingLayout
