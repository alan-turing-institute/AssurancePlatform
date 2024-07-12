import {
  DocumentDuplicateIcon,
  FolderIcon,
  UsersIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

export const navigation = [
  { name: 'My Assurance Cases', href: '/dashboard', icon: FolderIcon, current: false , externalLink: false},
  { name: 'Shared With Me', href: '/dashboard/shared', icon: UsersIcon, current: false , externalLink: false},
  // { name: 'Users', href: '/users', icon: UserGroupIcon, current: false, externalLink: false },
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

export const settingsNavigation = [
  { name: 'Account', href: '/settings', current: true },
  { name: 'Notifications', href: '/settings/notifications', current: false },
  { name: 'Billing', href: '/settings/billing', current: false },
  { name: 'Teams', href: '/settings/teams', current: false },
  { name: 'Integrations', href: '/settings/integrations', current: false },
]
