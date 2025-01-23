import {
  DocumentDuplicateIcon,
  FolderIcon,
  UsersIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import { Blocks } from 'lucide-react'

export const navigation = [
  { name: 'My Assurance Cases', href: '/dashboard', icon: FolderIcon, current: false , externalLink: false},
  { name: 'Shared With Me', href: '/dashboard/shared', icon: UsersIcon, current: false , externalLink: false},
  { name: 'Case Portfolio', href: '/dashboard/patterns', icon: Blocks, current: false , externalLink: false},
  // { name: 'Users', href: '/users', icon: UserGroupIcon, current: false, externalLink: false },
  // { name: 'Documentation', href: '/documentation', icon: DocumentDuplicateIcon, current: false, externalLink: true },
]

export const teams = [
  // { id: 1, name: 'Technology', href: '#', initial: 'T', current: false },
  // { id: 2, name: 'Automation', href: '#', initial: 'A', current: false },
  // { id: 3, name: 'General', href: '#', initial: 'G', current: false },
]

export const userNavigation = [
  { name: 'Your profile', href: '#' },
  { name: 'Sign out', href: '#' },
]

export const settingsNavigation = [
  { name: 'Account', href: '/settings', current: true },
  { name: 'Notifications', href: '/settings/notifications', current: false },
  { name: 'Billing', href: '/settings/billing', current: false },
  { name: 'Teams', href: '/settings/teams', current: false },
  { name: 'Integrations', href: '/settings/integrations', current: false },
]

// Dummy Data 
export const patterns = [
  { 
    id: 1, 
    title: 'Introduce AI', 
    description: 'Lorem ipsum dolor, sit amet consectetur adipisicing elit. Assumenda in, sint voluptas nemo fuga numquam veniam ullam? Odio, doloribus',
    authors: 'Chris Burr',
    category: 'AI',
    publishedDate: new Date(),
    lastModifiedOn: new Date(),
    createdOn: new Date(), 
    sector: 'Business',
    contact: 'rich.griffiths@gmail.com',
    assuranceCases: [
      { id: crypto.randomUUID(), name: 'Assurance Case Title Example' },
      { id: crypto.randomUUID(), name: 'Assurance Case Title Example' }
    ],
    image: 'https://images.unsplash.com/photo-1682685797743-3a7b6b8d8149?q=80&w=2970&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    published: true
  },
  { 
    id: 2, 
    title: 'Manage Org Best Practice', 
    description: 'Lorem ipsum dolor, sit amet consectetur adipisicing elit. Assumenda in, sint voluptas nemo fuga numquam veniam ullam? Odio, doloribus',
    authors: 'Marlon Dedakis',
    category: 'Management',
    publishedDate: new Date(),
    lastModifiedOn: new Date(),
    createdOn: new Date(), 
    sector: 'Business',
    contact: 'rich.griffiths@gmail.com',
    assuranceCases: [
      { id: crypto.randomUUID(), name: 'Assurance Case Title Example' }
    ],
    image: 'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?q=80&w=3044&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    published: true
  },
  { 
    id: 3, 
    title: 'Innovate with meaning', 
    description: 'Lorem ipsum dolor, sit amet consectetur adipisicing elit. Assumenda in, sint voluptas nemo fuga numquam veniam ullam? Odio, doloribus',
    authors: 'Rich Griffiths',
    category: 'Innovation',
    publishedDate: new Date(),
    lastModifiedOn: new Date(),
    createdOn: new Date(), 
    sector: 'Business',
    contact: 'rich.griffiths@gmail.com',
    assuranceCases: [
      { id: crypto.randomUUID(), name: 'Assurance Case Title Example' }
    ],
    image: null,
    published: false
  },
  { 
    id: 4, 
    title: 'AI Research Principles', 
    description: 'Lorem ipsum dolor, sit amet consectetur adipisicing elit. Assumenda in, sint voluptas nemo fuga numquam veniam ullam? Odio, doloribus',
    authors: 'Chris Burr, Marlon Dedakis',
    category: 'AI',
    publishedDate: new Date(),
    lastModifiedOn: new Date(),
    createdOn: new Date(), 
    sector: 'Business',
    contact: 'rich.griffiths@gmail.com',
    assuranceCases: [],
    image: null,
    published: false
  },
]