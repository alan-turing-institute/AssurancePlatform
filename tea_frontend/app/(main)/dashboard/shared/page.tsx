import { authOptions } from '.*/auth-options';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { fetchSharedAssuranceCases } from '@/actions/assurance-cases';
import CaseList from '@/components/cases/case-list';
import NoCasesFound from '@/components/cases/no-cases-found';

const SharedWithMePage = async () => {
  const session = await getServerSession(authOptions);

  // Redirect user to login if no `key`
  if (!session?.key) {
    redirect('/login');
  }

  const sharedAssuranceCases = await fetchSharedAssuranceCases(session.key);

  return (
    <>
      {sharedAssuranceCases.length === 0 ? (
        <NoCasesFound message={'No cases shared with you yet.'} shared />
      ) : (
        <CaseList assuranceCases={sharedAssuranceCases} />
      )}
    </>
  );
};

export default SharedWithMePage;
