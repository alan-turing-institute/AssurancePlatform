import { Navbar } from '@/components/navigation/Navbar'
import { authOptions } from '@/lib/authOptions'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children } : { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if(!session || !session.user) redirect('/login')

  return (
    <>
      <Navbar>
        {children}
      </Navbar>
    </>
  )
}
