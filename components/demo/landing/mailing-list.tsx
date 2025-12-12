/*
  This example requires some changes to your config:

  ```
  // tailwind.config.js
  module.exports = {
    // ...
    plugins: [
      // ...
      require('@tailwindcss/forms'),
    ],
  }
  ```
*/
export default function MailingList() {
	return (
		<div className="bg-white py-16 sm:py-24">
			<div className="relative sm:py-16">
				<div aria-hidden="true" className="hidden sm:block">
					<div className="absolute inset-y-0 left-0 w-1/2 rounded-r-3xl bg-gray-50" />
					<svg
						className="-ml-3 absolute top-8 left-1/2"
						fill="none"
						height={392}
						viewBox="0 0 404 392"
						width={404}
					>
						<title>Decorative background pattern</title>
						<defs>
							<pattern
								height={20}
								id="8228f071-bcee-4ec8-905a-2a059a2cc4fb"
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
							fill="url(#8228f071-bcee-4ec8-905a-2a059a2cc4fb)"
							height={392}
							width={404}
						/>
					</svg>
				</div>
				<div className="mx-auto max-w-md px-6 sm:max-w-3xl lg:max-w-7xl lg:px-8">
					<div className="relative overflow-hidden rounded-2xl bg-indigo-600 px-6 py-10 shadow-xl sm:px-12 sm:py-20">
						<div
							aria-hidden="true"
							className="-mt-72 sm:-mt-32 absolute inset-0 md:mt-0"
						>
							<svg
								className="absolute inset-0 h-full w-full"
								fill="none"
								preserveAspectRatio="xMidYMid slice"
								viewBox="0 0 1463 360"
							>
								<title>Background geometric pattern</title>
								<path
									className="text-indigo-500 text-opacity-40"
									d="M-82.673 72l1761.849 472.086-134.327 501.315-1761.85-472.086z"
									fill="currentColor"
								/>
								<path
									className="text-indigo-700 text-opacity-40"
									d="M-217.088 544.086L1544.761 72l134.327 501.316-1761.849 472.086z"
									fill="currentColor"
								/>
							</svg>
						</div>
						<div className="relative">
							<div className="sm:text-center">
								<h2 className="font-bold text-3xl text-white tracking-tight sm:text-4xl">
									Get notified when we&rsquo;re launching.
								</h2>
								<p className="mx-auto mt-6 max-w-2xl text-indigo-200 text-lg">
									Sagittis scelerisque nulla cursus in enim consectetur quam.
									Dictum urna sed consectetur neque tristique pellentesque.
								</p>
							</div>
							<form action="#" className="mt-12 sm:mx-auto sm:flex sm:max-w-lg">
								<div className="min-w-0 flex-1">
									<label className="sr-only" htmlFor="cta-email">
										Email address
									</label>
									<input
										className="block w-full rounded-md border border-transparent px-5 py-3 text-base text-gray-900 placeholder-gray-500 shadow-xs focus:border-transparent focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
										id="cta-email"
										placeholder="Enter your email"
										type="email"
									/>
								</div>
								<div className="mt-4 sm:mt-0 sm:ml-3">
									<button
										className="block w-full rounded-md border border-transparent bg-indigo-500 px-5 py-3 font-medium text-base text-white shadow-sm hover:bg-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600 sm:px-10"
										type="submit"
									>
										Notify me
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
