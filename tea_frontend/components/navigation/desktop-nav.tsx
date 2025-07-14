'use client';

import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation, teams } from '@/config';
import { Separator } from '../ui/separator';
import LoggedInUser from './logged-in-user';

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ');
}

const DesktopNav = () => {
  const pathname = usePathname();
  const _pageName =
    pathname === '/' ? 'assurance cases' : pathname.split('/')[1];

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 px-6 pb-4 dark:bg-slate-900">
        <div className="flex shrink-0 items-center">
          <Link href={'/dashboard'}>
            <div className="my-3 flex items-center justify-start gap-2 font-semibold text-white">
              {/* <svg className='w-6 h-6' fill='white' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 2v2.06A8.522 8.522 0 0 0 4.05 9H2v6h2.06A8.494 8.494 0 0 0 9 19.95V22h6v-2.06A8.494 8.494 0 0 0 19.95 15H22V9h-2.06A8.522 8.522 0 0 0 15 4.05V2m-4 2h2v2h-2m-2 .25V8h6V6.25c1.18.61 2.14 1.57 2.75 2.75H16v6h1.75A6.406 6.406 0 0 1 15 17.75V16H9v1.75A6.406 6.406 0 0 1 6.25 15H8V9H6.25A6.406 6.406 0 0 1 9 6.25M4 11h2v2H4m14-2h2v2h-2m-7 5h2v2h-2"></path></svg> */}
              <Image
                alt="Turing Ethical Assurance Logo"
                className="w-16"
                height={64}
                src="/images/tea-logo2.png"
                width={64}
              />
              <span className="-ml-3 text-sm leading-4">
                Trustworthy and Ethical Assurance Platform
              </span>
            </div>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col gap-y-4">
            <li>
              <ul className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <a
                      className={classNames(
                        item.href === pathname
                          ? 'bg-indigo-700 text-white'
                          : 'text-indigo-200 hover:bg-indigo-700 hover:text-white dark:hover:bg-indigo-700/60',
                        'group flex items-center gap-x-3 rounded-md p-2 font-semibold text-sm leading-6'
                      )}
                      href={item.href}
                      target={item.externalLink ? '_blank' : '_self'}
                    >
                      <item.icon
                        aria-hidden="true"
                        className={classNames(
                          item.current
                            ? 'text-white'
                            : 'text-indigo-200 group-hover:text-white',
                          'h-6 w-6 shrink-0'
                        )}
                      />
                      {item.name}
                      {item.externalLink && (
                        <ExternalLink className="ml-auto hidden h-4 w-4 group-hover:block" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
            <Separator className="bg-indigo-700/80 dark:bg-slate-800" />
            <li>
              <div className="font-semibold text-indigo-200 text-xs leading-6">
                Your teams
              </div>
              <ul className="-mx-2 mt-2 space-y-1">
                {teams.length === 0 && (
                  <p className="px-2 text-indigo-100/60 text-sm dark:text-slate-300/50">
                    No teams added
                  </p>
                )}
                {teams.length > 0 &&
                  teams.map((team: any) => (
                    <li key={team.name}>
                      <a
                        className={classNames(
                          team.current
                            ? 'bg-indigo-700 text-white'
                            : 'text-indigo-200 hover:bg-indigo-700 hover:text-white',
                          'group flex gap-x-3 rounded-md p-2 font-semibold text-sm leading-6'
                        )}
                        href={team.href}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-indigo-400 bg-indigo-500 font-medium text-[0.625rem] text-white">
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
                className="group -mx-2 flex items-center gap-x-3 rounded-md p-2 font-semibold text-indigo-200 text-sm leading-6 hover:bg-indigo-700 hover:text-white"
                href="https://github.com/alan-turing-institute/AssurancePlatform"
                rel="noopener"
                target="_blank"
              >
                <GitHubLogoIcon
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                />
                GitHub
                <ExternalLink className="ml-auto hidden h-4 w-4 group-hover:block" />
              </a>
            </li>
            <li>
              <a
                className="group -mx-2 flex items-center gap-x-3 rounded-md p-2 font-semibold text-indigo-200 text-sm leading-6 hover:bg-indigo-700 hover:text-white"
                href="/documentation"
                rel="noopener"
                target="_blank"
              >
                <DocumentDuplicateIcon
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 text-indigo-200 group-hover:text-white"
                />
                Documentation
                <ExternalLink className="ml-auto hidden h-4 w-4 group-hover:block" />
              </a>
            </li>
            {/* <li className="">
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
            </li> */}
          </ul>

          <Separator className="my-4 bg-indigo-700/80 dark:bg-slate-800" />

          <LoggedInUser />
        </nav>
      </div>
    </div>
  );
};

export default DesktopNav;
