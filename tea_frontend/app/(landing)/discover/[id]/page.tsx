import { fetchPublishedCaseStudyById } from '@/actions/caseStudies';
import { MailIcon, MoveLeftIcon, Users2Icon } from 'lucide-react';
import moment from 'moment';
import Link from 'next/link';
import React from 'react';
import CaseStudyCases from '../../_components/CaseStudyCases';

const DiscoverCaseStudyPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const caseStudy = await fetchPublishedCaseStudyById(parseInt(id));

  return (
    <div className="overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="absolute bottom-0 left-3/4 top-0 hidden w-screen bg-gray-50 lg:block" />
        <div className="mx-auto text-base lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-8">
          <div>
            <Link
              href={`/discover`}
              className="text-white mb-12 inline-flex justify-start items-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-2 px-3 rounded-md"
            >
              <MoveLeftIcon className="size-3" />
              Back
            </Link>

            <h3 className="mt-2 text-3xl/8 font-bold tracking-tight text-gray-900 sm:text-4xl">
              {caseStudy.title}
            </h3>
            <div className="mt-3 flex justify-start items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                {caseStudy.sector}
              </span>
              <p className="text-sm text-muted-foreground">
                Published On{' '}
                {moment(caseStudy.publishedDate).format('DD/MM/YYYY')}
              </p>
            </div>
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
                  <rect
                    x={0}
                    y={0}
                    fill="currentColor"
                    width={4}
                    height={4}
                    className="text-gray-200"
                  />
                </pattern>
              </defs>
              <rect
                fill="url(#de316486-4a29-4312-bdfc-fbce2132a2c1)"
                width={404}
                height={384}
              />
            </svg>
            <div className="relative mx-auto text-base lg:max-w-none">
              <figure>
                <img
                  alt={caseStudy.title}
                  src={
                    caseStudy.feature_image_url ??
                    'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
                  }
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
              <div className="text-black flex justify-start items-center gap-2 mb-10">
                <div className="text-sm flex justify-start items-center gap-2 mr-4">
                  <MailIcon className="size-4" /> {caseStudy.contact}
                </div>
                <div className="text-sm flex justify-start items-center gap-2">
                  <Users2Icon className="size-4" />
                  {caseStudy.authors}
                </div>
              </div>
              <div className="prose">
                <div
                  dangerouslySetInnerHTML={{
                    __html: caseStudy.description.replace('<p><br></p>', ''),
                  }}
                />
              </div>

              <div className="pt-6">
                <CaseStudyCases assuranceCaseIds={caseStudy.assurance_cases} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoverCaseStudyPage;
