'use client';

import { LogOutIcon } from 'lucide-react';
// import { useLoginToken } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import ActionTooltip from '../ui/action-tooltip';
import { Button } from '../ui/button';

const LogoutButton = () => {
  const [isMounted, setIsMounted] = useState(false);
  // const [token, setToken] = useLoginToken();
  const { data: session } = useSession();
  const router = useRouter();
  const { data } = useSession();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
    // const storedToken = token || (isMounted && localStorage.getItem('token')); // Safe usage of localStorage
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/auth/logout/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${data?.key}`,
        },
      }
    );
    if (response.status === 200) {
      // setToken(null);

      // if(data?.provider === 'github') {
      //   signOut()
      // }

      await signOut();
      router.push('/login');
    }
  };

  return (
    <ActionTooltip label="Logout">
      <Button onClick={handleLogout} size={'sm'} variant={'ghost'}>
        <LogOutIcon className="h-4 w-4" />
        <span className="sr-only">Logout</span>
      </Button>
    </ActionTooltip>
  );
};

export default LogoutButton;
