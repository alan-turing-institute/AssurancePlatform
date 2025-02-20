import { fetchCaseStudyById, fetchPublishedCaseStudyById } from '@/actions/caseStudies'
import { Button } from '@/components/ui/button'
import { CalendarDaysIcon, CameraIcon, GroupIcon, MailIcon, MoveLeftIcon, Users2Icon } from 'lucide-react'
import moment from 'moment'
import Link from 'next/link'
import React from 'react'

const DiscoverCaseStudyPage = async ({ params } : { params: { id: string } }) => {
  const { id } = params
  const caseStudy = await fetchPublishedCaseStudyById(parseInt(id))

  return (
    <div className="overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="absolute bottom-0 left-3/4 top-0 hidden w-screen bg-gray-50 lg:block" />
        <div className="mx-auto max-w-prose text-base lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-8">
          <div>
            <Link href={`/discover`} className='text-black mb-4 inline-flex justify-start items-center gap-2 hover:bg-gray-100 py-2 px-3 rounded-md'>
              <MoveLeftIcon className='size-3'/>
              Back
            </Link>
            <h2 className="text-lg font-semibold text-indigo-600">Case Study</h2>
            <h3 className="mt-2 text-3xl/8 font-bold tracking-tight text-gray-900 sm:text-4xl">{caseStudy.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">Published On {moment(caseStudy.publishedDate).format('DD/MM/YYYY')}</p>
          </div>
        </div>
        <div className="mt-8 lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="relative lg:col-start-2 lg:row-start-1">
            <svg
              fill="none"
              width={404}
              height={384}
              viewBox="0 0 404 384"
              aria-hidden="true"
              className="absolute right-0 top-0 -mr-20 -mt-20 hidden lg:block"
            >
              <defs>
                <pattern
                  x={0}
                  y={0}
                  id="de316486-4a29-4312-bdfc-fbce2132a2c1"
                  width={20}
                  height={20}
                  patternUnits="userSpaceOnUse"
                >
                  <rect x={0} y={0} fill="currentColor" width={4} height={4} className="text-gray-200" />
                </pattern>
              </defs>
              <rect fill="url(#de316486-4a29-4312-bdfc-fbce2132a2c1)" width={404} height={384} />
            </svg>
            <div className="relative mx-auto max-w-prose text-base lg:max-w-none">
              <figure>
                <img
                  alt={caseStudy.title}
                  src={caseStudy.image ?? 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'}
                  width={1184}
                  height={1376}
                  className="aspect-[12/7] w-full rounded-lg object-cover shadow-lg lg:aspect-auto"
                />
                <figcaption className="mt-3 flex text-sm text-gray-500">
                  <span className="ml-2">{`${caseStudy.title} featured image`}</span>
                </figcaption>
              </figure>
            </div>
          </div>
          <div className="mt-8 lg:mt-0">
            <div className="mx-auto text-base/7 text-gray-500">
              <div className='text-black flex justify-start items-center gap-2 mb-4'>
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                  {caseStudy.category}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  {caseStudy.sector}
                </span>
                <div className='text-sm flex justify-start items-center gap-2 mr-4'><MailIcon className='size-4'/> {caseStudy.contact}</div>
                <div className='text-sm flex justify-start items-center gap-2'><Users2Icon className='size-4'/> {caseStudy.authors}</div>
              </div>
              <div className="prose">
                <div dangerouslySetInnerHTML={{ __html: caseStudy.description.replace(/\n/g, "<br>") }} />
              </div>
              {/* <p className="text-lg/7">
                Sagittis scelerisque nulla cursus in enim consectetur quam. Dictum urna sed consectetur neque tristique
                pellentesque. Blandit amet, sed aenean erat arcu morbi.
              </p>
              <p className="mt-5">
                Sollicitudin tristique eros erat odio sed vitae, consequat turpis elementum. Lorem nibh vel, eget
                pretium arcu vitae. Eros eu viverra donec ut volutpat donec laoreet quam urna.
              </p>
              <p className="mt-5">
                Bibendum eu nulla feugiat justo, elit adipiscing. Ut tristique sit nisi lorem pulvinar. Urna, laoreet
                fusce nibh leo. Dictum et et et sit. Faucibus sed non gravida lectus dignissim imperdiet a.
              </p>
              <p className="mt-5">
                Dictum magnis risus phasellus vitae quam morbi. Quis lorem lorem arcu, metus, egestas netus cursus. In.
              </p>
              <ul role="list" className="mt-5 list-disc space-y-2 pl-6 marker:text-gray-300">
                <li className="pl-2">Quis elit egestas venenatis mattis dignissim.</li>
                <li className="pl-2">Cras cras lobortis vitae vivamus ultricies facilisis tempus.</li>
                <li className="pl-2">Orci in sit morbi dignissim metus diam arcu pretium.</li>
              </ul>
              <p className="mt-5">
                Rhoncus nisl, libero egestas diam fermentum dui. At quis tincidunt vel ultricies. Vulputate aliquet
                velit faucibus semper. Pellentesque in venenatis vestibulum consectetur nibh id. In id ut tempus
                egestas. Enim sit aliquam nec, a. Morbi enim fermentum lacus in. Viverra.
              </p>
              <h3 className="mt-8 text-xl/8 font-semibold text-gray-900">How we helped</h3>
              <p className="mt-3">
                Tincidunt integer commodo, cursus etiam aliquam neque, et. Consectetur pretium in volutpat, diam.
                Montes, magna cursus nulla feugiat dignissim id lobortis amet. Laoreet sem est phasellus eu proin massa,
                lectus. Diam rutrum posuere donec ultricies non morbi. Mi a platea auctor mi.
              </p>
              <p className="mt-5">
                Sagittis scelerisque nulla cursus in enim consectetur quam. Dictum urna sed consectetur neque tristique
                pellentesque. Blandit amet, sed aenean erat arcu morbi.
              </p>
              */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DiscoverCaseStudyPage