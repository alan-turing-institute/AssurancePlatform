import { authOptions } from '.*/auth-options';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Navbar } from '@/components/navigation/navbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.key) {
    redirect('/login');
  }

  return <Navbar>{children}</Navbar>;
}
