'use client'

import { useState } from "react"
import MemberEdit from "./MemberEdit"

const people = [
  {
    id: 1,
    name: 'Rich Griffiths',
    title: 'Full Stack Developer',
    department: 'Technology',
    email: 'rich.griffiths89@gmail.com',
    role: 'Admin',
    isAdmin: true,
    image:
      'https://res.cloudinary.com/dfs5xyvsv/image/upload/v1688998317/self_port-0142_edited_p5jqqw.jpg',
  },
  {
    id: 2,
    name: 'Marlon Dedakis',
    title: 'Developer',
    department: 'Technology',
    email: 'marlonscloud@gmail.com',
    role: 'Member',
    isAdmin: false,
    image:
      'https://ca.slack-edge.com/E03KWED6CG5-U06MEU0UZSP-ecd95213a9c0-512',
  },
  {
    id: 3,
    name: 'Kalle Westerling',
    title: 'SCRUM Master',
    department: 'Optimization',
    email: 'kwesterling@turing.ac.uk',
    role: 'Member',
    isAdmin: false,
    image:
      'https://ca.slack-edge.com/E03KWED6CG5-U030YSVFWEP-d243db60062e-512',
  },
  {
    id: 4,
    name: 'Christopher Burr',
    title: 'Project Manager',
    department: 'Projects',
    email: 'cburr@turing.ac.uk',
    role: 'Member',
    isAdmin: false,
    image:
      'https://ca.slack-edge.com/E03KWED6CG5-U03KXHCSEHH-3e6c9201c305-512',
  },
  // More people...
]

export default function MemberList() {
  const [editOpen, setEditOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState({})

  const handleEdit = (person: any) => {
    setSelectedMember(person)
    setEditOpen(true)
  }

  return (
    <>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-base font-semibold leading-6 text-foreground">Team Members</h1>
            <p className="mt-2 text-sm text-foreground/70">
              A list of all the members in your account including their name, title, email and role.
            </p>
          </div>
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <button
              type="button"
              className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Add user
            </button>
          </div>
        </div>
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-900">
                <thead>
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-0">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                      Title
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                      Role
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-900">
                  {people.map((person) => (
                    <tr key={person.email}>
                      <td className="whitespace-nowrap py-5 pl-4 pr-3 text-sm sm:pl-0">
                        <div className="flex items-center">
                          <div className="h-11 w-11 flex-shrink-0">
                            <img className="h-11 w-11 rounded-full object-cover" src={person.image} alt="" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-foreground">{person.name}</div>
                            <div className="mt-1 text-gray-500">{person.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
                        <div className="text-foreground">{person.title}</div>
                        <div className="mt-1 text-gray-500">{person.department}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Active
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-sm text-foreground">{person.role}</td>
                      <td className="relative whitespace-nowrap py-5 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <button onClick={() => handleEdit(person)} className="text-indigo-600 hover:text-indigo-900">
                          Edit<span className="sr-only">, {person.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <MemberEdit member={selectedMember} isOpen={editOpen} onClose={() => setEditOpen(false)} />
    </>
  )
}
