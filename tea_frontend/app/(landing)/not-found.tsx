import Link from 'next/link';

export default function Example() {
  return (
    <>
      {/*
        This example requires updating your template:

        ```
        <html class="h-full">
        <body class="h-full">
        ```
      */}
      <main className="grid min-h-full place-items-center bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="text-center">
          <p className="font-semibold text-base text-indigo-600">404</p>
          <h1 className="mt-4 text-balance font-semibold text-5xl text-gray-900 tracking-tight sm:text-7xl">
            Page not found
          </h1>
          <p className="mt-6 text-pretty font-medium text-gray-500 text-lg sm:text-xl/8">
            Sorry, we couldn’t find the page you’re looking for.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 font-semibold text-sm text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              href="/discover"
            >
              Back to Discover
            </Link>
            <a
              className="font-semibold text-gray-900 text-sm"
              href="mailto:cburr@turing.ac.uk"
            >
              Contact support <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
