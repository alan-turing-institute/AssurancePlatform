'use client';

// import { useLoginToken } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { signOut, useSession } from 'next-auth/react';
import { LogOutIcon } from 'lucide-react';
import ActionTooltip from '../ui/action-tooltip';

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
      <Button size={'sm'} variant={'ghost'} onClick={handleLogout}>
        <LogOutIcon className="w-4 h-4" />
        <span className="sr-only">Logout</span>
      </Button>
    </ActionTooltip>
  );
};

export default LogoutButton;
