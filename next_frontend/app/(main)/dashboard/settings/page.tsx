'use client'

import React, { useEffect, useState } from 'react'
import SettingsNav from './_components/SettingsNav'
import { PersonalInfoForm } from './_components/PeronsalInfoForm'
import { PasswordForm } from './_components/PasswordForm'
import { unauthorized, useLoginToken } from '@/hooks/useAuth'
import { Loader2, Router } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AlertModal } from '@/components/modals/alertModal'
import { useRouter } from 'next/navigation'

const SettingsPage = () => {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false)

  const router = useRouter()
  const [token, setToken] = useLoginToken()
  const { toast } = useToast()

  const notify = (message: string) => {
    toast({
      description: message,
    });
  };

  const notifyError = (message: string) => {
    toast({
      variant: 'destructive',
      title: 'Uh oh! Something went wrong.',
      description: message,
    });
  };

  const fetchCurrentUser = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/user/`, requestOptions);

    if(response.status === 404 || response.status === 403 ) {
      // TODO: 404 NOT FOUND PAGE
      console.log('Render Not Found Page')
      return
    }

    if(response.status === 401) return unauthorized()

    const result = await response.json()
    return result
  }

  const handleDeleteUser = async () => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/users/${currentUser.id}/`;

      const requestOptions: RequestInit = {
        method: "DELETE",
        headers: {
          Authorization: `Token ${token}`
        }
      }

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        notifyError('Something went wrong')
        return
      }

      setToken(null);
      router.push('/login')
    } catch (error) {
      console.log(error)
    }
    setDeleteOpen(false)
  }

  useEffect(() => {
    fetchCurrentUser().then(result => {
      setCurrentUser(result)
      setLoading(false)
    })
  },[])

  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>

      {/* <header className="border-b border-foreground/500">
        <SettingsNav />
      </header> */}

      {loading ? (
        <div className='min-h-screen flex justify-center items-start p-6'>
          <Loader2 className='w-6 h-6 animate-spin' />
        </div>
      ) : (
        <>
          <div className="divide-y divide-foreground/5 min-h-screen">
            <PersonalInfoForm data={currentUser} />
            <PasswordForm data={currentUser} />
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
              <div>
                <h2 className="text-base font-semibold leading-7 text-foreground">Delete account</h2>
                <p className="mt-1 text-sm leading-6 text-gray-400">
                  No longer want to use our service? You can delete your account here. This action is not reversible.
                  All information related to this account will be deleted permanently.
                </p>
              </div>

              <form className="flex items-start md:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-400"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true)
                  }}
                >
                  Yes, delete my account
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteUser}
        loading={deleteLoading}
        message={'Are you sure you want to delete your account? This will sign you out immediatley.'}
        confirmButtonText={'Yes, delete my account!'}
        cancelButtonText={'No, keep my account'}
      />

    </main>
  )
}

export default SettingsPage
