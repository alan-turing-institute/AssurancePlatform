import { Box, Grid, Paper } from '@mui/material'
import React from 'react'

const LoginLayout = ({ children } : { children : React.ReactNode }) => {
  return (
    <Grid container component="main" sx={{ height: '100vh' }}>
      <Grid
        item
        xs={false}
        sm={4}
        md={7}
        sx={{
          backgroundImage: 'url(https://assuranceplatform.azurewebsites.net/static/media/building-an-assurance-case-adjusted-aspect-ratio.24a4b38575eb488728ff.png)',
          backgroundRepeat: 'no-repeat',
          // backgroundColor: (t) =>
          //   t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
        <Box sx={{ padding:'4rem 2rem' }}>
          {children}
        </Box>
      </Grid>
    </Grid>
  )
}

export default LoginLayout
