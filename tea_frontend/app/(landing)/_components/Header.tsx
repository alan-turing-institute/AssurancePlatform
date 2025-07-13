'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const navigation = [
    // { name: 'Showcase', href: '/documentation' },
    { name: 'Documentation', href: '/documentation', external: true },
    // { name: 'Documentation', href: 'https://alan-turing-institute.github.io/AssurancePlatform/' },
    { name: 'GitHub', href: 'https://github.com/alan-turing-institute/AssurancePlatform', external: true },
    { name: 'Discover', href: '/discover', external: false },
  ]

  const { data: session } = useSession()

  useEffect(() => {
    if(session?.key) {
      setLoggedIn(true)
    }
  },[session?.key])

  return (
    <header className="">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 flex justify-start items-center gap-2">
            <Image
              className="h-12 w-auto"
              src="/images/tea-logo.png"
              alt="TEA Platform Logo"
              width={48}
              height={48}
            />
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {navigation.map((item) => (
            <a key={item.name} href={item.href} target={item.external ? '_blank' : '_self'} className="text-sm font-semibold leading-6 text-gray-900">
              {item.name}
            </a>
          ))}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            {loggedIn ? (
              <a href="/dashboard" className="text-sm font-semibold leading-6 text-gray-900">
                    Get Started <span aria-hidden="true">&rarr;</span>
              </a>
            ) : (
              <a href="/login" className="text-sm font-semibold leading-6 text-gray-900">
                    Log in <span aria-hidden="true">&rarr;</span>
              </a>
            )}
        </div>
      </nav>
      <Dialog as="div" className="lg:hidden" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
        <div className="fixed inset-0 z-50" />
        <Dialog.Panel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div className="flex items-center justify-between">
            <Link href="/" className="-m-1.5 p-1.5">
              <Image
                className="h-12 w-auto"
                src="/images/tea-logo.png"
                alt="TEA Platform Logo"
                width={48}
                height={48}
              />
            </Link>
            <button
              type="button"
              className="-m-2.5 rounded-md p-2.5 text-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-500/10">
              <div className="space-y-2 py-6">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    target='_blank'
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
              <div className="py-6">
                <a
                  href="/login"
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                >
                  Log in
                </a>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </Dialog>
    </header>
  )
}

export default Header
