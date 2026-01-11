"use client";

import { useRouter } from "next/navigation";
import { updateCaseStudy } from "@/actions/case-studies";
import { useToast } from "@/lib/toast";
import type { CaseStudy } from "@/types/domain";

type PublishButtonProps = {
	label: string;
	published: boolean;
	caseStudy: CaseStudy;
};

const PublishButton = ({ label, published, caseStudy }: PublishButtonProps) => {
	const { toast } = useToast();
	const _router = useRouter();

	// const handlePublish = async () => {
	//   if(published) {
	//     // Then handle the unpblish
	//     const unPublishCaseStudy = {
	//       ...caseStudy,
	//       published: false,
	//     }

	//     const unpublished = await updateCaseStudy(data?.key, unPublishCaseStudy)

	//     if(unpublished) {
	//       toast({
	//         title: 'Successfully Unpublished',
	//         description: 'You have unpublished your case study!',
	//       });
	//       router.back()
	//     } else {
	//       toast({
	//         variant: "destructive",
	//         title: 'Failed to Update',
	//         description: 'Something went wrong!',
	//       });
	//     }
	//   } else {
	//     // Then handle the publish
	//     const publishCaseStudy = {
	//       ...caseStudy,
	//       published_date: new Date().toISOString(),
	//       published: true,
	//     }

	//     const published = await updateCaseStudy(data?.key, publishCaseStudy)

	//     if(published) {
	//       toast({
	//         title: 'Successfully Published',
	//         description: 'You have published your case study!',
	//       });
	//       router.back()
	//     } else {
	//       toast({
	//         variant: "destructive",
	//         title: 'Failed to Update',
	//         description: 'Something went wrong!',
	//       });
	//     }
	//   }
	// }

	const handlePublish = async () => {
		const formData = new FormData();
		formData.append("id", caseStudy.id.toString());
		formData.append(
			"assurance_cases",
			JSON.stringify(caseStudy.assurance_cases || [])
		);

		// Set only the fields that need updating
		if (published) {
			formData.append("published", "false"); // Convert boolean to string
			formData.append("published_date", ""); // Clear the published date
		} else {
			formData.append("published", "true"); // Convert boolean to string
			formData.append("published_date", new Date().toISOString()); // Set new date
		}

		// Send the formData to the API
		const response = await updateCaseStudy("", formData);

		if (response) {
			toast({
				title: published
					? "Successfully Unpublished"
					: "Successfully Published",
				description: `You have ${published ? "unpublished" : "published"} your case study!`,
			});
		} else {
			toast({
				variant: "destructive",
				title: "Failed to Update",
				description: "Something went wrong!",
			});
		}
	};

	return (
		<button
			className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-xs hover:bg-indigo-700 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
			onClick={handlePublish}
			type="button"
		>
			{label}
		</button>
	);
};

export default PublishButton;
