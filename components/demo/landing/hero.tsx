"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function Hero() {
	const { data: session } = useSession();

	return (
		<div className="bg-white">
			<main>
				<div className="relative isolate">
					<svg
						aria-hidden="true"
						className="-z-10 absolute inset-x-0 top-0 h-256 w-full stroke-gray-200 mask-[radial-gradient(32rem_32rem_at_center,white,transparent)]"
					>
						<defs>
							<pattern
								height={200}
								id="1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84"
								patternUnits="userSpaceOnUse"
								width={200}
								x="50%"
								y={-1}
							>
								<path d="M.5 200V.5H200" fill="none" />
							</pattern>
						</defs>
						<svg className="overflow-visible fill-gray-50" x="50%" y={-1}>
							<title>Background decoration pattern</title>
							<path
								d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
								strokeWidth={0}
							/>
						</svg>
						<rect
							fill="url(#1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84)"
							height="100%"
							strokeWidth={0}
							width="100%"
						/>
					</svg>
					<div
						aria-hidden="true"
						className="-z-10 -ml-24 absolute top-0 right-0 left-1/2 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
					>
						<div
							className="aspect-801/1036 w-200.25 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30"
							style={{
								clipPath:
									"polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)",
							}}
						/>
					</div>
					<div className="overflow-hidden">
						<div className="mx-auto max-w-7xl px-6 pb-32 lg:px-8">
							<div className="mx-auto w-full gap-8 lg:grid lg:grid-cols-2 lg:items-center">
								{/* <div className="mx-auto max-w-2xl gap-x-14 lg:mx-0 lg:flex lg:max-w-none lg:items-center"> */}
								<div className="relative w-full">
									{/* max-w-xl lg:shrink-0 xl:max-w-2xl */}
									<div className="mb-6 inline-flex rounded-md border border-indigo-300 bg-indigo-100 px-3 py-2 font-semibold text-indigo-500 text-xs">
										Available as a Research Preview
									</div>
									<h1 className="font-bold text-4xl text-gray-900 tracking-tight sm:text-6xl">
										Build trust, collaboratively.
									</h1>
									<p className="mt-6 text-gray-600 text-lg leading-8 sm:max-w-full lg:max-w-none">
										The Trustworthy and Ethical Assurance (TEA) Platform is an
										innovative, open-source tool designed to facilitate the
										process of creating, managing and sharing assurance cases
										for data-driven technologies, such as digital twins or AI.
									</p>
									<div className="mt-10 flex items-center gap-x-6">
										<Link
											className="rounded-md bg-indigo-600 px-3.5 py-2.5 font-semibold text-sm text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
											href={
												session?.key
													? "/dashboard"
													: "/login?redirect=/dashboard"
											}
										>
											{session?.key ? "Go to Dashboard" : "Get started"}
										</Link>
										<a
											className="font-semibold text-gray-900 text-sm leading-6"
											href="/docs/curriculum"
										>
											Learn more <span aria-hidden="true">→</span>
										</a>
									</div>
								</div>
								{/* sm:-mt-44 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0 */}
								<div className="mt-14 flex justify-end gap-8">
									<div className="w-full overflow-hidden rounded-lg shadow-xl">
										<video
											autoPlay
											loop
											muted
											src="/images/building-an-assurance-case.mp4"
										/>
									</div>
									{/* <div className="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-0 xl:pt-80">
                    <div className="relative">
                      <img
                        src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&h=528&q=80"
                        alt=""
                        className="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                  </div>
                  <div className="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
                    <div className="relative">
                      <img
                        src="https://images.unsplash.com/photo-1485217988980-11786ced9454?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&h=528&q=80"
                        alt=""
                        className="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                    <div className="relative">
                      <img
                        src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&crop=focalpoint&fp-x=.4&w=396&h=528&q=80"
                        alt=""
                        className="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                  </div>
                  <div className="w-44 flex-none space-y-8 pt-32 sm:pt-0">
                    <div className="relative">
                      <img
                        src="https://images.unsplash.com/photo-1670272504528-790c24957dda?ixlib=rb-4.0.3&ixid=MnwxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&crop=left&w=400&h=528&q=80"
                        alt=""
                        className="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                    <div className="relative">
                      <img
                        src="https://images.unsplash.com/photo-1670272505284-8faba1c31f7d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&h=528&q=80"
                        alt=""
                        className="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                  </div> */}
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
