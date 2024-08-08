'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Menu, Transition } from '@headlessui/react'
import {
  Bars3Icon,
  BellIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { ModeToggle } from '@/components/ui/theme-toggle'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { navigation, teams, userNavigation } from '@/config'
import { Button } from '@/components/ui/button'
import LogoutButton from '@/components/auth/LogoutButton'
import { usePathname, useRouter } from 'next/navigation'
import { Toaster } from "@/components/ui/sonner"
import FeedbackBanner from '@/components/FeedbackBanner'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useLoginToken } from '@/hooks/useAuth'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export default function DashboardLayout({ children } : { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname();
  const pageName = pathname === '/' ? 'assurance cases' : pathname.split('/')[1]
  const router = useRouter()

  const [token, setToken] = useLoginToken();

  const { data } = useSession()

  useEffect(() => {
    console.log('Token', token)
    if(token) return

    if(data?.user && token === null) {
      setToken(data?.accessToken);
    } else if (!data?.user || token === null) {
      router.push('/login')
    }
  },[])

  return (
    <>
      <div>
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                      <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </button>
                    </div>
                  </Transition.Child>
                  {/* Sidebar component, swap this element with another sidebar if you like */}
                  <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 dark:bg-slate-900 px-6 pb-4">
                    <div className="flex h-16 shrink-0 items-center">
                      <Link href={'/dashboard'}>
                        <p className='text-white font-semibold flex justify-start items-center gap-2'>
                          <svg className='w-6 h-6' fill='white' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 2v2.06A8.522 8.522 0 0 0 4.05 9H2v6h2.06A8.494 8.494 0 0 0 9 19.95V22h6v-2.06A8.494 8.494 0 0 0 19.95 15H22V9h-2.06A8.522 8.522 0 0 0 15 4.05V2m-4 2h2v2h-2m-2 .25V8h6V6.25c1.18.61 2.14 1.57 2.75 2.75H16v6h1.75A6.406 6.406 0 0 1 15 17.75V16H9v1.75A6.406 6.406 0 0 1 6.25 15H8V9H6.25A6.406 6.406 0 0 1 9 6.25M4 11h2v2H4m14-2h2v2h-2m-7 5h2v2h-2"></path></svg>
                          Assurance Platform
                        </p>
                      </Link>
                    </div>
                    <nav className="flex flex-1 flex-col">
                      <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                          <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                              <li key={item.name}>
                                <a
                                  href={item.href}
                                  target={(!item.externalLink) ? '_self' : '_blank'}
                                  className={classNames(
                                    item.href === pathname
                                      ? 'bg-indigo-700 text-white'
                                      : 'text-indigo-200 hover:text-white hover:bg-indigo-700 dark:hover:bg-indigo-700/60',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                  )}
                                >
                                  <item.icon
                                    className={classNames(
                                      item.current ? 'text-white' : 'text-indigo-200 group-hover:text-white',
                                      'h-6 w-6 shrink-0'
                                    )}
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </li>
                        <li>
                          <div className="text-xs font-semibold leading-6 text-indigo-200">Your teams</div>
                          <ul role="list" className="-mx-2 mt-2 space-y-1">
                            {teams.length === 0 && (
                              <p className='text-indigo-100/60 dark:text-slate-300/50 text-sm px-2'>No teams added</p>
                            )}
                            {teams.length > 0 && teams.map((team: any) => (
                              <li key={team.name}>
                                <a
                                  href={team.href}
                                  className={classNames(
                                    team.current
                                      ? 'bg-indigo-700 text-white'
                                      : 'text-indigo-200 hover:text-white hover:bg-indigo-700',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                  )}
                                >
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-indigo-400 bg-indigo-500 text-[0.625rem] font-medium text-white">
                                    {team.initial}
                                  </span>
                                  <span className="truncate">{team.name}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </li>
                        <li className="mt-auto">
                          <a
                            href="https://github.com/alan-turing-institute/AssurancePlatform"
                            target='_blank'
                            className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-indigo-200 hover:bg-indigo-700 hover:text-white"
                          >
                            <GitHubLogoIcon
                              className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                              aria-hidden="true"
                            />
                            GitHub
                          </a>
                        </li>
                        <li className="">
                          <a
                            href="#"
                            className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-indigo-200 hover:bg-indigo-700 hover:text-white"
                          >
                            <Cog6ToothIcon
                              className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                              aria-hidden="true"
                            />
                            Settings
                          </a>
                        </li>
                      </ul>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 dark:bg-slate-900 px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <Link href={'/dashboard'}>
                <p className='text-white font-semibold flex justify-start items-center gap-2'>
                  <svg className='w-6 h-6' fill='white' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 2v2.06A8.522 8.522 0 0 0 4.05 9H2v6h2.06A8.494 8.494 0 0 0 9 19.95V22h6v-2.06A8.494 8.494 0 0 0 19.95 15H22V9h-2.06A8.522 8.522 0 0 0 15 4.05V2m-4 2h2v2h-2m-2 .25V8h6V6.25c1.18.61 2.14 1.57 2.75 2.75H16v6h1.75A6.406 6.406 0 0 1 15 17.75V16H9v1.75A6.406 6.406 0 0 1 6.25 15H8V9H6.25A6.406 6.406 0 0 1 9 6.25M4 11h2v2H4m14-2h2v2h-2m-7 5h2v2h-2"></path></svg>
                  Assurance Platform
                </p>
              </Link>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          target={(!item.externalLink) ? '_self' : '_blank'}
                          className={classNames(
                            item.href === pathname
                              ? 'bg-indigo-700 text-white'
                              : 'text-indigo-200 hover:text-white hover:bg-indigo-700 dark:hover:bg-indigo-700/60',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold items-center'
                          )}
                        >
                          <item.icon
                            className={classNames(
                              item.current ? 'text-white' : 'text-indigo-200 group-hover:text-white',
                              'h-6 w-6 shrink-0'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                          {item.externalLink && <ExternalLink className='w-4 h-4 ml-auto hidden group-hover:block' />}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
                <li>
                  <div className="text-xs font-semibold leading-6 text-indigo-200">Your teams</div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
                    {teams.length === 0 && (
                      <p className='text-indigo-100/60 dark:text-slate-300/50 text-sm px-2'>No teams added</p>
                    )}
                    {teams.length > 0 && teams.map((team: any) => (
                      <li key={team.name}>
                        <a
                          href={team.href}
                          className={classNames(
                            team.current
                              ? 'bg-indigo-700 text-white'
                              : 'text-indigo-200 hover:text-white hover:bg-indigo-700',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-indigo-400 bg-indigo-500 text-[0.625rem] font-medium text-white">
                            {team.initial}
                          </span>
                          <span className="truncate">{team.name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="mt-auto">
                  <a
                    href="https://github.com/alan-turing-institute/AssurancePlatform"
                    target='_blank'
                    className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-indigo-200 hover:bg-indigo-700 hover:text-white items-center"
                  >
                    <GitHubLogoIcon
                      className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                      aria-hidden="true"
                    />
                    GitHub
                    <ExternalLink className='w-4 h-4 ml-auto hidden group-hover:block' />
                  </a>
                </li>
                <li className="">
                  <Link
                    href="/dashboard/settings"
                    className={`group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-indigo-200 hover:bg-indigo-700 hover:text-white ${pathname === '/dashboard/settings' ? 'bg-indigo-700 text-white' : null}`}
                  >
                    <Cog6ToothIcon
                      className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                      aria-hidden="true"
                    />
                    Settings
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="lg:pl-72">
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-foreground/10 bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button type="button" className="-m-2.5 p-2.5 text-foreground lg:hidden" onClick={() => setSidebarOpen(true)}>
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            <div className='flex flex-1 justify-start items-center'>
              <h2 className='text-foreground font-medium capitalize'>
                {pageName}
              </h2>
            </div>

            <div className="flex justify-end gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <button type="button" className="-m-2.5 p-2.5 text-foreground hover:text-foreground/80">
                  <span className="sr-only">View notifications</span>
                  <BellIcon className="h-6 w-6" aria-hidden="true" />
                </button>

                <ModeToggle />

                {/* Separator */}
                <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" aria-hidden="true" />

                {/* Profile dropdown */}
                {/* <Menu as="div" className="relative">
                  <Menu.Button className="-m-1.5 flex items-center p-1.5">
                    <span className="sr-only">Open user menu</span>
                    <img
                      className="h-8 w-8 rounded-full bg-gray-50"
                      src="https://res.cloudinary.com/dfs5xyvsv/image/upload/v1688998317/self_port-0142_edited_p5jqqw.jpg"
                      alt=""
                    />
                    <span className="hidden lg:flex lg:items-center">
                      <span className="ml-4 text-sm font-semibold leading-6 text-foreground" aria-hidden="true">
                        Rich Griffiths
                      </span>
                      <ChevronDownIcon className="ml-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-background py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                      {userNavigation.map((item) => (
                        <Menu.Item key={item.name}>
                          {({ active }) => (
                            <a
                              href={item.href}
                              className={classNames(
                                active ? 'bg-gray-50' : '',
                                'block px-3 py-1 text-sm leading-6 text-foreground hover:bg-foreground/10'
                              )}
                            >
                              {item.name}
                            </a>
                          )}
                        </Menu.Item>
                      ))}
                    </Menu.Items>
                  </Transition>
                </Menu> */}

                {data?.user?.name}
                <LogoutButton />
              </div>
            </div>
          </div>

          <main className="bg-background text-foreground">
            <div>
              {/* Your content */}
              {children}
              <FeedbackBanner />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
