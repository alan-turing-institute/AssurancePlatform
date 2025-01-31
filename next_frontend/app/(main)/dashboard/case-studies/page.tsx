import PageHeading from '@/components/ui/page-heading'
import { Separator } from '@/components/ui/separator'
import { caseStudies } from '@/config'
import { Edit2Icon } from 'lucide-react'
import moment from 'moment'
import Link from 'next/link'
import React from 'react'

function CaseStudiesPage() {
  return (
    <div className='p-8 space-y-4 min-h-screen'>
      <PageHeading 
        title='Assurance Case Patterns' 
        description='Here you manage all your public patterns'
        button={{ label: 'Create', action: () => {} }} 
      />
      <Separator />

      <div className="">
        <div className="-mx-4 mt-8 sm:-mx-0">
          <table className="min-w-full divide-y divide-foreground/10">
            <thead>
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-0">
                  Title
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-left text-sm font-semibold text-foreground lg:table-cell"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-left text-sm font-semibold text-foreground sm:table-cell"
                >
                  Authors
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-left text-sm font-semibold text-foreground sm:table-cell"
                >
                  Category
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                  Published
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10 bg-background">
              {caseStudies.map((caseStudy) => (
                <tr key={caseStudy.id}>
                  <td className="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:w-auto sm:max-w-none sm:pl-0">
                    <Link href={`case-studies/${caseStudy.id}`} className='hover:text-indigo-500 transition-all duration-200 group'>
                      {caseStudy.title}
                    </Link>
                    <dl className="font-normal lg:hidden">
                      <dt className="sr-only">Title</dt>
                      <dd className="mt-1 truncate text-foreground/80">{caseStudy.title}</dd>
                      <dt className="sr-only sm:hidden">Published</dt>
                      <dd className="mt-1 truncate text-gray-500 sm:hidden">{moment(caseStudy.publishedDate).format('DD/MM/YYYY')}</dd>
                    </dl>
                  </td>
                  <td className="hidden px-3 py-4 text-sm text-foreground/80 lg:table-cell max-w-[220px] truncate">{caseStudy.description}</td>
                  <td className="hidden px-3 py-4 text-sm text-foreground/80 sm:table-cell">{caseStudy.authors}</td>
                  <td className="px-3 py-4 text-sm text-foreground/80">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-100/10 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-500 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-500/20">
                      {caseStudy.category}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm text-foreground/80">{moment(caseStudy.publishedDate).format('DD/MM/YYYY')}</td>
                  <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a href="#" className="text-indigo-500 hover:text-indigo-600">
                      <Edit2Icon className='size-4' /><span className="sr-only">, {caseStudy.title}</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default CaseStudiesPage

