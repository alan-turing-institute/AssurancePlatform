import React from 'react'
import PreviewBanner from './_components/PreviewBanner'

const LandingLayout = ({ children } : { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <PreviewBanner />
    </>
  )
}

export default LandingLayout
