import Navigation from '@/components/Navigation'
import { Box, Toolbar } from '@mui/material'
import React from 'react'

const MainLayout = ({ children } : { children : React.ReactNode }) => {
  return (
    <>
      <Navigation />
      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          height: "100vh",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </>
  )
}

export default MainLayout
