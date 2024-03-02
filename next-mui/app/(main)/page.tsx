'use client'

import React, { useEffect, useState } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import NextLink from 'next/link';
import { LayoutWithNav } from '@/components/common/Layouts';
import ManageCases from '@/components/cases/ManageCases';
import { useLoginToken } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
// import ProTip from '@/components/ProTip';
// import Copyright from '@/components/Copyright';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token] = useLoginToken();
  const router = useRouter()

  useEffect(() => {
    if(token) {
      setIsLoggedIn(token != null);
    } else {
      router.push('/login')
    }
  },[token])

  return (
    <>
      {!isLoggedIn ? (
        <></>
      ) : (
        <LayoutWithNav>
          <ManageCases />
        </LayoutWithNav>
      )}
    </>
    
  );
}
