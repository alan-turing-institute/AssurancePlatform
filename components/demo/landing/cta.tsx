export default function CTA() {
	return (
		<div className="bg-primary dark:bg-primary-foreground">
			<div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-bold text-3xl text-primary-foreground tracking-tight sm:text-4xl dark:text-primary">
						Boost your assurance case process.
						<br />
						Start using TEA today.
					</h2>
					<p className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/70 leading-8 dark:text-primary/70">
						You can sign up and test the TEA platform in action today. If would
						like to set up the platform in your own, private environment, please
						get in touch!
					</p>
					<div className="mt-10 flex items-center justify-center gap-x-6">
						<a
							className="rounded-md bg-primary-foreground px-3.5 py-2.5 font-semibold text-primary text-sm shadow-xs hover:bg-primary-foreground/90 focus-visible:outline-2 focus-visible:outline-primary-foreground focus-visible:outline-solid focus-visible:outline-offset-2 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
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
