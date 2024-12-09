import { Navbar } from '@/components/navigation/Navbar'

export default function DashboardLayout({ children } : { children: React.ReactNode }) {
  return (
    <>
      <Navbar>
        {children}
      </Navbar>
    </>
  )
}
