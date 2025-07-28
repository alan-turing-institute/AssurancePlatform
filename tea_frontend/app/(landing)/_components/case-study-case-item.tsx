import { fetchPublishedAssuranceCaseId } from "@/actions/case-studies";
import DownloadCaseButton from "./download-case-button";

interface CaseStudyCaseItemProps {
	assuranceCaseId: string;
}

const CaseStudyCaseItem = async ({
	assuranceCaseId,
}: CaseStudyCaseItemProps) => {
	const publishedAssuranceCase =
		await fetchPublishedAssuranceCaseId(assuranceCaseId);

	return (
		<li
			className="relative flex flex-col justify-start gap-x-6 px-4 py-5 hover:cursor-pointer hover:bg-gray-50 sm:px-6"
			key={publishedAssuranceCase.id}
		>
			<div className="flex min-w-0 gap-x-4">
				<div className="min-w-0 flex-auto">
					<p className="mb-2 font-semibold text-gray-900 text-md">
						{publishedAssuranceCase.title}
					</p>
					<p className="text-gray-500 text-sm">
						{publishedAssuranceCase.description}
					</p>
				</div>
			</div>

			<DownloadCaseButton
				content={publishedAssuranceCase.content}
				title={publishedAssuranceCase.title}
			/>
		</li>
	);
};

export default CaseStudyCaseItem;
