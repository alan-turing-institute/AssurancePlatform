import { Loader2, Router } from 'lucide-react';
import { redirect, useRouter } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/actions/users';
import { AlertModal } from '@/components/modals/alertModal';
import { useToast } from '@/components/ui/use-toast';
import { unauthorized, useLoginToken } from '@/hooks/useAuth';
import { authOptions } from '@/lib/authOptions';
import { DeleteForm } from './_components/DeleteForm';
import { PasswordForm } from './_components/PasswordForm';
import { PersonalInfoForm } from './_components/PeronsalInfoForm';

const SettingsPage = async () => {
  const session = await getServerSession(authOptions);

  // Redirect user to login if no `key`
  if (!(session && session.key)) {
    redirect('/login');
  }

  const currentUser = await fetchCurrentUser(session.key);

  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>
      {/* <header className="border-b border-foreground/500">
        <SettingsNav />
      </header> */}
      <div className="min-h-screen divide-y divide-foreground/5">
        <PersonalInfoForm data={currentUser} />
        <PasswordForm data={currentUser} />
        <DeleteForm user={currentUser} />
      </div>
    </main>
  );
};

export default SettingsPage;
