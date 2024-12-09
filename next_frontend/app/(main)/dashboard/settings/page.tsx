import React, { useEffect, useState } from 'react'
import { PersonalInfoForm } from './_components/PeronsalInfoForm'
import { PasswordForm } from './_components/PasswordForm'
import { unauthorized, useLoginToken } from '@/hooks/useAuth'
import { Loader2, Router } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AlertModal } from '@/components/modals/alertModal'
import { redirect, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { fetchCurrentUser } from '@/actions/users'
import { DeleteForm } from './_components/DeleteForm'

const SettingsPage = async () => {
  const session = await getServerSession(authOptions)
  
  // Redirect user to login if no `key`
  if(!session || !session.key) {
    redirect('/login')
  }

  const currentUser = await fetchCurrentUser(session.key)

  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>
      {/* <header className="border-b border-foreground/500">
        <SettingsNav />
      </header> */}
      <div className="divide-y divide-foreground/5 min-h-screen">
        <PersonalInfoForm data={currentUser} />
        <PasswordForm data={currentUser} />
        <DeleteForm user={currentUser} />
      </div>
    </main>
  )
}

export default SettingsPage
