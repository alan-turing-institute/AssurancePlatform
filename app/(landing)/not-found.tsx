import Link from "next/link";

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
			<main className="grid min-h-full place-items-center bg-background px-6 py-24 sm:py-32 lg:px-8">
				<div className="text-center">
					<p className="font-semibold text-base text-primary">404</p>
					<h1 className="mt-4 text-balance font-semibold text-5xl text-foreground tracking-tight sm:text-7xl">
						Page not found
					</h1>
					<p className="mt-6 text-pretty font-medium text-lg text-muted-foreground sm:text-xl/8">
						Sorry, we couldn’t find the page you’re looking for.
					</p>
					<div className="mt-10 flex items-center justify-center gap-x-6">
						<Link
							className="rounded-md bg-primary px-3.5 py-2.5 font-semibold text-primary-foreground text-sm shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-solid focus-visible:outline-offset-2"
							href="/discover"
						>
							Back to Discover
						</Link>
						<a
							className="font-semibold text-foreground text-sm"
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
