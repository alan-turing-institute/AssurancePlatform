import BackButton from '@/components/ui/back-button'
import PageHeading from '@/components/ui/page-heading'
import moment from 'moment'
import React from 'react'
import CaseStudyForm from '../_components/CaseStudyForm'
import { deleteCaseStudy, fetchCaseStudyById, updateCaseStudy } from '@/actions/caseStudies'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'

async function CaseStudyDetails({ params } : { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  // Redirect user to login if no `key`
  if(!session || !session.key) {
    redirect('/login')
  }

  const { id } = params

  const caseStudy = await fetchCaseStudyById(session.key, parseInt(id))

  return (
    <div className='p-8 min-h-screen space-y-4'>
      <BackButton url='/dashboard/case-studies' />
      <PageHeading
        title={caseStudy.title}
        description={`Created On ${moment(caseStudy.createdOn).format('DD/MM/YYYY')}`}
        // button={{ label: caseStudy.published ? 'Unpublish' : 'Publish', published: caseStudy.published }}
        caseStudy={caseStudy}
      />

      <CaseStudyForm caseStudy={caseStudy} />

      {/* <div>
        <div className="mt-6">
          <dl className="grid grid-cols-1 sm:grid-cols-3">
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-6 sm:col-span-1 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Domain/Sector</dt>
              <dd className="mt-1 text-sm/6 text-foreground sm:mt-2">{caseStudy.sector}</dd>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-6 sm:col-span-1 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Date Published</dt>
              <dd className="mt-1 text-sm/6 text-foreground sm:mt-2">{moment(caseStudy.publishedDate).format('DD/MM/YYYY')}</dd>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-6 sm:col-span-1 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Category</dt>
              <dd className="mt-1 text-sm/6 text-foreground sm:mt-2">{caseStudy.category}</dd>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-6 sm:col-span-1 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Contact</dt>
              <dd className="mt-1 text-sm/6 text-foreground sm:mt-2">{caseStudy.contact}</dd>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-6 sm:col-span-2 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Authors</dt>
              <dd className="mt-1 text-sm/6 text-foreground sm:mt-2">{caseStudy.authors}</dd>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-6 sm:col-span-3 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Description</dt>
              <dd className="mt-1 text-sm/6 text-foreground sm:mt-2">
                {caseStudy.description}
              </dd>
            </div>
            <div className="border-t border-foreground/20 px-4 py-6 sm:col-span-3 sm:px-0">
              <dt className="text-sm/6 font-medium text-foreground">Assurance Cases</dt>
              <dd className="mt-2 text-sm text-foreground">
                {caseStudy.assuranceCases.length > 0 ? (
                  <ul role="list" className="divide-y divide-foreground/20 rounded-md border border-foreground/20">
                    {caseStudy.assuranceCases.map(item => (
                      <li key={item.id} className="flex items-center justify-between py-4 pl-4 pr-5 text-sm/6">
                        <div className="flex w-0 flex-1 items-center">
                          <PaperclipIcon aria-hidden="true" className="size-5 shrink-0 text-gray-400" />
                          <div className="ml-4 flex min-w-0 flex-1 gap-2">
                            <span className="truncate font-medium">{item.name}</span>
                          </div>
                        </div>
                        <div className="ml-4 shrink-0">
                          <a href="#" className="font-medium text-indigo-500 hover:text-indigo-500">
                            Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className='text-muted-foreground'>No Assurance Cases Added.</p>
                )}
              </dd>
            </div>
          </dl>
          <p className="text-sm/6 font-medium text-foreground mb-2">Image</p>
          {caseStudy.image ? (
            <div className="w-10/12 relative h-[500px] group">
              <Image
                src={
                  'https://images.unsplash.com/photo-1682685797743-3a7b6b8d8149?q=80&w=2970&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
                }
                alt="image"
                fill
                className="object-cover aspect-video rounded-lg"
              />
              <div className="absolute bg-slate-900/70 h-full w-full flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Button variant={'destructive'}><Trash2Icon className='size-4 mr-2'/>Remove</Button>
              </div>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>No Image Added.</p>
          )}
        </div>
      </div> */}

    </div>
  )
}

export default CaseStudyDetails
