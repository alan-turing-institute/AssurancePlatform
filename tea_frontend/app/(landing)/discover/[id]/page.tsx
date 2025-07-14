import { MailIcon, MoveLeftIcon, Users2Icon } from 'lucide-react';
import moment from 'moment';
import Image from 'next/image';
import Link from 'next/link';
import { fetchPublishedCaseStudyById } from '@/actions/case-studies';
import { extractTextFromHtml } from '@/lib/sanitize-html';
import CaseStudyCases from '../../_components/case-study-cases';

const DiscoverCaseStudyPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const caseStudy = await fetchPublishedCaseStudyById(Number.parseInt(id, 10));

  return (
    <div className="overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="absolute top-0 bottom-0 left-3/4 hidden w-screen bg-gray-50 lg:block" />
        <div className="mx-auto text-base lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-8">
          <div>
            <Link
              className="mb-12 inline-flex items-center justify-start gap-2 rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500"
              href={'/discover'}
            >
              <MoveLeftIcon className="size-3" />
              Back
            </Link>

            <h3 className="mt-2 font-bold text-3xl/8 text-gray-900 tracking-tight sm:text-4xl">
              {caseStudy.title}
            </h3>
            <div className="mt-3 flex items-center justify-start gap-3">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-700 text-xs">
                {caseStudy.sector}
              </span>
              <p className="text-muted-foreground text-sm">
                Published On{' '}
                {moment(caseStudy.publishedDate).format('DD/MM/YYYY')}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="relative lg:col-start-2 lg:row-start-1">
            <svg
              aria-hidden="true"
              className="-mr-20 -mt-20 absolute top-0 right-0 hidden lg:block"
              fill="none"
              height={384}
              viewBox="0 0 404 384"
              width={404}
            >
              <defs>
                <pattern
                  height={20}
                  id="de316486-4a29-4312-bdfc-fbce2132a2c1"
                  patternUnits="userSpaceOnUse"
                  width={20}
                  x={0}
                  y={0}
                >
                  <rect
                    className="text-gray-200"
                    fill="currentColor"
                    height={4}
                    width={4}
                    x={0}
                    y={0}
                  />
                </pattern>
              </defs>
              <rect
                fill="url(#de316486-4a29-4312-bdfc-fbce2132a2c1)"
                height={384}
                width={404}
              />
            </svg>
            <div className="relative mx-auto text-base lg:max-w-none">
              <figure>
                <Image
                  alt={caseStudy.title}
                  className="aspect-[12/7] w-full rounded-lg object-cover shadow-lg lg:aspect-auto"
                  height={1376}
                  src={
                    caseStudy.feature_image_url ??
                    'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
                  }
                  width={1184}
                />
                <figcaption className="mt-3 flex text-gray-500 text-sm">
                  <span className="ml-2">{`${caseStudy.title} featured image`}</span>
                </figcaption>
              </figure>
            </div>
          </div>
          <div className="mt-8 lg:mt-0">
            <div className="mx-auto text-base/7 text-gray-500">
              <div className="mb-10 flex items-center justify-start gap-2 text-black">
                <div className="mr-4 flex items-center justify-start gap-2 text-sm">
                  <MailIcon className="size-4" /> {caseStudy.contact}
                </div>
                <div className="flex items-center justify-start gap-2 text-sm">
                  <Users2Icon className="size-4" />
                  {caseStudy.authors}
                </div>
              </div>
              <div className="prose">
                <div>{extractTextFromHtml(caseStudy.description)}</div>
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
