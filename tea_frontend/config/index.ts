import { Sector } from '@/types'
import {
  FolderIcon,
  UsersIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { Blocks } from 'lucide-react'

export const navigation = [
  { name: 'My Assurance Cases', href: '/dashboard', icon: FolderIcon, current: false , externalLink: false},
  { name: 'Shared With Me', href: '/dashboard/shared', icon: UsersIcon, current: false , externalLink: false},
  { name: 'Case Studies', href: '/dashboard/case-studies', icon: Blocks, current: false , externalLink: false},
  { name: 'Discover Public Projects', href: '/discover', icon: GlobeAltIcon, current: false , externalLink: false},
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
export const caseStudies = [
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
    image: '',
    // image: 'https://images.unsplash.com/photo-1682685797743-3a7b6b8d8149?q=80&w=2970&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
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


export const sectors = [
	{
		"ID": 1,
		"Name": "Agriculture, Forestry & Fishing",
		"Description": "Growing crops, raising animals, managing forests and catching fish to supply food and raw materials.",
		"ISICcode": "A",
		"NACEcode": "A"
	},
	{
		"ID": 2,
		"Name": "Mining, Quarrying & Extraction",
		"Description": "Digging or drilling the earth for minerals, metals, stone, oil and gas that feed industry and energy systems.",
		"ISICcode": "B",
		"NACEcode": "B"
	},
	{
		"ID": 3,
		"Name": "Energy Production & Supply",
		"Description": "Generating and distributing electricity, heat, oil, gas and renewable power that keep homes, businesses and transport running.",
		"ISICcode": "D",
		"NACEcode": "D"
	},
	{
		"ID": 4,
		"Name": "Utilities & Environmental Services",
		"Description": "Delivering clean water, treating wastewater, collecting rubbish and recycling, and cleaning up pollution.",
		"ISICcode": "E",
		"NACEcode": "E"
	},
	{
		"ID": 5,
		"Name": "Construction & Civil Engineering",
		"Description": "Building and maintaining houses, offices, roads, bridges and other physical infrastructure.",
		"ISICcode": "F",
		"NACEcode": "F"
	},
	{
		"ID": 6,
		"Name": "Manufacturing & Industrial Production",
		"Description": "Turning raw or semi‑processed materials into finished goods.",
		"ISICcode": "C",
		"NACEcode": "C"
	},
	{
		"ID": 7,
		"Name": "Wholesale & Retail Trade",
		"Description": "Buying goods in bulk and selling them on to shops or directly to consumers in stores and online.",
		"ISICcode": "G",
		"NACEcode": "G"
	},
	{
		"ID": 8,
		"Name": "Transportation & Logistics",
		"Description": "Moving people and goods by road, rail, air, sea and pipelines, plus warehousing and delivery services.",
		"ISICcode": "H",
		"NACEcode": "H"
	},
	{
		"ID": 9,
		"Name": "Information, Communication & Media",
		"Description": "Creating, processing and transmitting data, software, news, entertainment and telecoms services.",
		"ISICcode": "J",
		"NACEcode": "J"
	},
	{
		"ID": 10,
		"Name": "Financial Services",
		"Description": "Managing money through banking, investment, insurance, pensions and related advisory activities.",
		"ISICcode": "K",
		"NACEcode": "K"
	},
	{
		"ID": 11,
		"Name": "Real‑Estate & Property Management",
		"Description": "Buying, selling, renting and looking after land and buildings for living, working or investment.",
		"ISICcode": "L",
		"NACEcode": "L"
	},
	{
		"ID": 12,
		"Name": "Professional, Scientific & Technical Services",
		"Description": "Providing expert knowledge such as engineering design, R&D, consulting, accountancy and advertising.",
		"ISICcode": "M",
		"NACEcode": "M"
	},
	{
		"ID": 13,
		"Name": "Public Administration, Defence & Security",
		"Description": "Government bodies that make policy, deliver public services and protect national safety.",
		"ISICcode": "O",
		"NACEcode": "O"
	},
	{
		"ID": 14,
		"Name": "Education & Training",
		"Description": "Schools, colleges, universities and lifelong learning organisations that teach skills and capabilities.",
		"ISICcode": "P",
		"NACEcode": "P"
	},
	{
		"ID": 15,
		"Name": "Health & Social Care",
		"Description": "Hospitals, clinics, care homes and community services that maintain physical and mental well-being.",
		"ISICcode": "Q",
		"NACEcode": "Q"
	},
	{
		"ID": 16,
		"Name": "Accommodation, Food Service & Tourism",
		"Description": "Hotels, restaurants, cafés and travel operators that host, feed and entertain visitors.",
		"ISICcode": "I, N",
		"NACEcode": "I, N"
	},
	{
		"ID": 17,
		"Name": "Arts, Entertainment & Creative Industries",
		"Description": "Producing culture and leisure activities such as music, film, gaming, museums and live events.",
		"ISICcode": "R",
		"NACEcode": "R"
	},
	{
		"ID": 18,
		"Name": "Legal Services & Justice",
		"Description": "Solicitors, barristers, courts and mediation bodies that advise on and enforce the law.",
		"ISICcode": "M, O",
		"NACEcode": "M, O"
	},
	{
		"ID": 19,
		"Name": "Personal & Other Community Services",
		"Description": "Everyday support such as hairdressing, dry‑cleaning, household repairs, gyms and charities.",
		"ISICcode": "N, S, T",
		"NACEcode": "N, S, T"
	},
	{
		"ID": 20,
		"Name": "Extraterrestrial & International Organisations",
		"Description": "Embassies, UN agencies, the International Space Station and other bodies operating outside national jurisdictions.",
		"ISICcode": "U",
		"NACEcode": "U"
	}
] as Sector[]
