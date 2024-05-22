import React from 'react'
import SettingsNav from './_components/SettingsNav'
import { PersonalInfoForm } from './_components/PeronsalInfoForm'
import { PasswordForm } from './_components/PasswordForm'

const SettingsPage = () => {
  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>

      {/* <header className="border-b border-foreground/500">
        <SettingsNav />
      </header> */}

      <div className="divide-y divide-foreground/5">
        {/* <PersonalInfoForm />
        <PasswordForm />
        <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
          <div>
            <h2 className="text-base font-semibold leading-7 text-foreground">Delete account</h2>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              No longer want to use our service? You can delete your account here. This action is not reversible.
              All information related to this account will be deleted permanently.
            </p>
          </div>

          <form className="flex items-start md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-400"
            >
              Yes, delete my account
            </button>
          </form>
        </div> */}
        <p>Settings coming soon...</p>
      </div>
    </main>
  )
}

export default SettingsPage
