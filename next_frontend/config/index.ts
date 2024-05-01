import {
  DocumentDuplicateIcon,
  FolderIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

export const navigation = [
  { name: 'Assurance Cases', href: '/', icon: FolderIcon, current: true , externalLink: false},
  // { name: 'Team', href: '/team', icon: UsersIcon, current: false, externalLink: false },
  { name: 'Documentation', href: 'https://alan-turing-institute.github.io/AssurancePlatform/', icon: DocumentDuplicateIcon, current: false, externalLink: true },
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