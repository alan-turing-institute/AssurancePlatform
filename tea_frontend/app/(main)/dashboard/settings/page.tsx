import { authOptions } from '.*/auth-options';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { fetchCurrentUser } from '@/actions/users';
import { DeleteForm } from './_components/delete-form';
import { PasswordForm } from './_components/password-form';
import { PersonalInfoForm } from './_components/personal-info-form';

const SettingsPage = async () => {
  const session = await getServerSession(authOptions);

  // Redirect user to login if no `key`
  if (!session?.key) {
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
