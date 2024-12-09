'use client'

import { navigation, teams } from '@/config'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink } from 'lucide-react'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

const DesktopNav = () => {
  const pathname = usePathname();
  const pageName = pathname === '/' ? 'assurance cases' : pathname.split('/')[1]

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 dark:bg-slate-900 px-6 pb-4">
        <div className="flex shrink-0 items-center">
          <Link href={'/dashboard'}>
            <div className='my-3 text-white font-semibold flex justify-start items-center gap-2'>
              {/* <svg className='w-6 h-6' fill='white' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 2v2.06A8.522 8.522 0 0 0 4.05 9H2v6h2.06A8.494 8.494 0 0 0 9 19.95V22h6v-2.06A8.494 8.494 0 0 0 19.95 15H22V9h-2.06A8.522 8.522 0 0 0 15 4.05V2m-4 2h2v2h-2m-2 .25V8h6V6.25c1.18.61 2.14 1.57 2.75 2.75H16v6h1.75A6.406 6.406 0 0 1 15 17.75V16H9v1.75A6.406 6.406 0 0 1 6.25 15H8V9H6.25A6.406 6.406 0 0 1 9 6.25M4 11h2v2H4m14-2h2v2h-2m-7 5h2v2h-2"></path></svg> */}
              <img
                src='/images/tea-logo2.png'
                alt='Turing Ethical Assurance Logo'
                className='w-16'
              />
              <span className='text-sm leading-4 -ml-3'>Trustworthy and Ethical Assurance Platform</span>
            </div>
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
  )
}

export default DesktopNav
