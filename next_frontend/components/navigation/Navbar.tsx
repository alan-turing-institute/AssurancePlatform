'use client'

import { useState } from 'react'
import { ModeToggle } from '@/components/ui/theme-toggle'
import LogoutButton from '@/components/auth/LogoutButton'
import { usePathname } from 'next/navigation'
import FeedbackBanner from '@/components/FeedbackBanner'
import { MobileNav } from './mobile-nav'
import DesktopNav from './desktop-nav'
import MenuToggleButton from './menu-toggle'

export const Navbar = ({ children } : { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname();
  const pageName = pathname === '/'
  ? 'assurance cases'
  : pathname.includes('/dashboard/case-studies')
    ? 'Case Studies'
    : pathname.split('/').filter(Boolean).pop();

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
