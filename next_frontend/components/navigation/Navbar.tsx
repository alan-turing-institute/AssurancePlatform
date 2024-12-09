'use client'

import { useEffect, useState } from 'react'
import { ModeToggle } from '@/components/ui/theme-toggle'
import LogoutButton from '@/components/auth/LogoutButton'
import { usePathname, useRouter } from 'next/navigation'
import FeedbackBanner from '@/components/FeedbackBanner'
import { useSession } from 'next-auth/react'
import { MobileNav } from './mobile-nav'
import DesktopNav from './desktop-nav'
import MenuToggleButton from './menu-toggle'
import { fetchCurrentUser } from '@/actions/users'

export const Navbar = ({ children } : { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const pathname = usePathname();
  const pageName = pathname === '/' ? 'assurance cases' : pathname.split('/')[1]

  const { data } = useSession()

  useEffect(() => {
    fetchCurrentUser(data?.key ?? '').then(result => setCurrentUser(result))
  },[])

  return (
    <div>
      <MobileNav sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Static sidebar for desktop */}
      <DesktopNav />

      <div className="lg:pl-72">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-foreground/10 bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <MenuToggleButton setSidebarOpen={setSidebarOpen} />

          <div className='flex flex-1 justify-start items-center'>
            <h2 className='text-foreground font-medium capitalize'>
              {pageName}
            </h2>
          </div>

          <div className="flex justify-end gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* <button type="button" className="-m-2.5 p-2.5 text-foreground hover:text-foreground/80">
                <span className="sr-only">View notifications</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
              </button> */}

              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" aria-hidden="true" />
              <div className='flex flex-col justify-start items-start'>
                <span>{currentUser?.username}</span>
                {/* <span className='text-xs text-muted-foreground'>({currentUser?.email})</span> */}
              </div>
              <LogoutButton />
              <ModeToggle />
            </div>
          </div>
        </div>

        <main className="bg-background text-foreground">
          <div>
            {children}
            <FeedbackBanner />
          </div>
        </main>
      </div>
    </div>
  )
}
