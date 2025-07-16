import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import BackButton from '@/components/ui/back-button';
import PageHeading from '@/components/ui/page-heading';
import { authOptions } from '@/lib/auth-options';
import CaseStudyForm from '../_components/case-study-form';

async function NewCaseStudy() {
  const session = await getServerSession(authOptions);

  // Redirect user to login if no `key`
  if (!session?.key) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen space-y-4 p-8">
      <BackButton url="/dashboard/case-studies" />
      <PageHeading
        description={
          'Use this form to create a case study to showcase your work.'
        }
        title="New Case Study"
      />

      <CaseStudyForm />
    </div>
  );
}

export default NewCaseStudy;
