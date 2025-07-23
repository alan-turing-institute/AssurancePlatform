import { fetchPublishedCaseStudies } from "@/actions/case-studies";
import CaseStudies from "../_components/case-studies";

const DiscoverPage = async () => {
	const publishedCaseStudies = await fetchPublishedCaseStudies();

	return (
		<>
			<div className="bg-white px-6 py-24 sm:py-20 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<p className="font-semibold text-base/7 text-indigo-600">
						Get the help you need
					</p>
					<h2 className="mt-2 font-semibold text-5xl text-gray-900 tracking-tight">
						Community Case Studies
					</h2>
					<p className="mt-8 text-pretty font-medium text-gray-500 text-lg sm:text-xl/8">
						Browse through all the case studies that have been created by our
						community.
					</p>
				</div>
			</div>

			<CaseStudies caseStudies={publishedCaseStudies} />
		</>
	);
};

export default DiscoverPage;
