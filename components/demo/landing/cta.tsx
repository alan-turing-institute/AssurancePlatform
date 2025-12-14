export default function CTA() {
	return (
		<div className="bg-indigo-700">
			<div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-bold text-3xl text-white tracking-tight sm:text-4xl">
						Boost your assurance case process.
						<br />
						Start using TEA today.
					</h2>
					<p className="mx-auto mt-6 max-w-xl text-indigo-200 text-lg leading-8">
						You can sign up and test the TEA platform in action today. If would
						like to set up the platform in your own, private environment, please
						get in touch!
					</p>
					<div className="mt-10 flex items-center justify-center gap-x-6">
						<a
							className="rounded-md bg-white px-3.5 py-2.5 font-semibold text-indigo-600 text-sm shadow-xs hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-white focus-visible:outline-offset-2"
							href="/docs/curriculum/quick-reference/01-platform-basics"
						>
							See it in action
						</a>
						{/* <a href="#" className="text-sm font-semibold leading-6 text-white">
              Learn more <span aria-hidden="true">→</span>
            </a> */}
					</div>
				</div>
			</div>
		</div>
	);
}
