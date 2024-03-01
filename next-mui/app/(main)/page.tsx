import * as React from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import NextLink from 'next/link';
import { LayoutWithNav } from '@/components/common/Layouts';
import ManageCases from '@/components/cases/ManageCases';
// import ProTip from '@/components/ProTip';
// import Copyright from '@/components/Copyright';

export default function Home() {
  return (
    <LayoutWithNav>
      <ManageCases />
    </LayoutWithNav>
  );
}
