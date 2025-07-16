import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Navbar } from '@/components/navigation/navbar';
import { authOptions } from '@/lib/auth-options';

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
