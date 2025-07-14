import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import React from 'react';
import { fetchAssuranceCases } from '@/actions/assuranceCases';
import { fetchCurrentUser } from '@/actions/users';
import CheckUserEmail from '@/components/CheckUserEmail';
import CaseList from '@/components/cases/CaseList';
import NoCasesFound from '@/components/cases/NoCasesFound';
import { authOptions } from '@/lib/authOptions';

const Dashboard = async () => {
  const session = await getServerSession(authOptions);

  // Redirect user to login if no `key`
  if (!(session && session.key)) {
    redirect('/login');
  }

  // Fetch current logged in user
  const currentUser = await fetchCurrentUser(session.key);
  if (currentUser == null) redirect('/login');

  // Fetch cases for current logged in user
  const assuranceCases = await fetchAssuranceCases(session.key);
  if (assuranceCases == null) redirect('/login');

  return (
    <>
      {assuranceCases.length === 0 ? (
        <NoCasesFound
          message={'Get started by creating your own assurance case.'}
        />
      ) : (
        <>
          <CheckUserEmail user={currentUser} />
          <CaseList assuranceCases={assuranceCases} showCreate />
        </>
      )}
    </>
  );
};

export default Dashboard;
