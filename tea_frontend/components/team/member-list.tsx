'use client';

import Image from 'next/image';
import { useState } from 'react';
import MemberEdit from './member-edit';

type TeamMember = {
  id: number;
  name: string;
  title: string;
  department: string;
  email: string;
  role: string;
  isAdmin: boolean;
  image: string;
};

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
    image: 'https://ca.slack-edge.com/E03KWED6CG5-U06MEU0UZSP-ecd95213a9c0-512',
  },
  {
    id: 3,
    name: 'Kalle Westerling',
    title: 'SCRUM Master',
    department: 'Optimization',
    email: 'kwesterling@turing.ac.uk',
    role: 'Member',
    isAdmin: false,
    image: 'https://ca.slack-edge.com/E03KWED6CG5-U030YSVFWEP-d243db60062e-512',
  },
  {
    id: 4,
    name: 'Christopher Burr',
    title: 'Project Manager',
    department: 'Projects',
    email: 'cburr@turing.ac.uk',
    role: 'Member',
    isAdmin: false,
    image: 'https://ca.slack-edge.com/E03KWED6CG5-U03KXHCSEHH-3e6c9201c305-512',
  },
  // More people...
];

export default function MemberList() {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const handleEdit = (person: TeamMember) => {
    setSelectedMember(person);
    setEditOpen(true);
  };

  return (
    <>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="font-semibold text-base text-foreground leading-6">
              Users
            </h1>
            <p className="mt-2 text-foreground/70 text-sm">
              A list of all users in your account including their name, title,
              email and role.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              className="block rounded-md bg-indigo-600 px-3 py-2 text-center font-semibold text-sm text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              type="button"
            >
              Add user
            </button>
          </div>
        </div>
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 sm:-mx-6 lg:-mx-8 overflow-x-auto">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-900">
                <thead>
                  <tr>
                    <th
                      className="py-3.5 pr-3 pl-4 text-left font-semibold text-foreground text-sm sm:pl-0"
                      scope="col"
                    >
                      Name
                    </th>
                    <th
                      className="px-3 py-3.5 text-left font-semibold text-foreground text-sm"
                      scope="col"
                    >
                      Title
                    </th>
                    <th
                      className="px-3 py-3.5 text-left font-semibold text-foreground text-sm"
                      scope="col"
                    >
                      Status
                    </th>
                    <th
                      className="px-3 py-3.5 text-left font-semibold text-foreground text-sm"
                      scope="col"
                    >
                      Role
                    </th>
                    <th
                      className="relative py-3.5 pr-4 pl-3 sm:pr-0"
                      scope="col"
                    >
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-900">
                  {people.map((person) => (
                    <tr key={person.email}>
                      <td className="whitespace-nowrap py-5 pr-3 pl-4 text-sm sm:pl-0">
                        <div className="flex items-center">
                          <div className="h-11 w-11 flex-shrink-0">
                            <Image
                              alt=""
                              className="h-11 w-11 rounded-full object-cover"
                              height={44}
                              src={person.image}
                              width={44}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-foreground">
                              {person.name}
                            </div>
                            <div className="mt-1 text-gray-500">
                              {person.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-gray-500 text-sm">
                        <div className="text-foreground">{person.title}</div>
                        <div className="mt-1 text-gray-500">
                          {person.department}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-gray-500 text-sm">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 text-xs ring-1 ring-emerald-600/20 ring-inset dark:bg-emerald-900/20">
                          Active
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-foreground text-sm">
                        {person.role}
                      </td>
                      <td className="relative whitespace-nowrap py-5 pr-4 pl-3 text-right font-medium text-sm sm:pr-0">
                        <button
                          className="text-indigo-600 hover:text-indigo-900"
                          onClick={() => handleEdit(person)}
                          type="button"
                        >
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
      <MemberEdit
        isOpen={editOpen}
        member={selectedMember}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
