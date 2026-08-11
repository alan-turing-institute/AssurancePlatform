import type { Metadata } from "next";
import { fetchPublishedItems } from "@/actions/discover";
import PublishedItems from "./_components/published-items";

export const metadata: Metadata = {
	title: "Community Case Studies | TEA Platform",
};

const DiscoverPage = async () => {
	const publishedItems = await fetchPublishedItems();

	return (
		<>
			<div className="bg-background px-6 py-24 sm:py-20 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<p className="font-semibold text-base/7 text-primary">
						Get the help you need
					</p>
					<h2 className="mt-2 font-semibold text-5xl text-foreground tracking-tight">
						Community Case Studies
					</h2>
					<p className="mt-8 text-pretty font-medium text-lg text-muted-foreground sm:text-xl/8">
						Browse published assurance cases from our community — each one a
						frozen, citable snapshot.
					</p>
				</div>
			</div>

			<PublishedItems items={publishedItems} />
		</>
	);
};

export default DiscoverPage;
