'use client'

import { useEnforceLogin, useLoginToken } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useCallback } from 'react'
import { Button } from '../ui/button';

const LogoutButton = () => {
  useEnforceLogin();
  const [token, setToken] = useLoginToken();
  const router = useRouter()

  // const handleLogout = useCallback(
  //   (e: any) => {
  //     e.preventDefault();
  //     // if (sessionExpired) {
  //     //   setToken(null);
  //     //   // window.location.replace("/");
  //     //   router.push('/')
  //     //   return;
  //     // }
  //     fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout/`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Token ${token}`,
  //       },
  //     })
  //       .then((res) => res.json())
  //       .then(() => {
  //         setToken(null);
  //         // window.location.replace("/");
  //         router.push('/')
  //       });
  //   },
  //   [token, setToken],
  // );

  const handleLogout = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
      })
    console.log(response.status)
    if(response.status === 200) {
      setToken(null);
      router.push('/login')
    }
  } 

  return (
    <Button
      onClick={handleLogout}
      className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      Logout
    </Button>
  )
}

export default LogoutButton
