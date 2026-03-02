"use client";

import { useRouter } from "next/navigation";
import { updateCaseStudy } from "@/actions/case-studies";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type { CaseStudy } from "@/types/domain";

type PublishButtonProps = {
	label: string;
	published: boolean;
	caseStudy: CaseStudy;
};

const PublishButton = ({ label, published, caseStudy }: PublishButtonProps) => {
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
			"assuranceCases",
			JSON.stringify(caseStudy.assuranceCases || [])
		);

		// Set only the fields that need updating
		if (published) {
			formData.append("published", "false"); // Convert boolean to string
			formData.append("publishedAt", ""); // Clear the published date
		} else {
			formData.append("published", "true"); // Convert boolean to string
			formData.append("publishedAt", new Date().toISOString()); // Set new date
		}

		// Send the formData to the API
		const response = await updateCaseStudy(formData);

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
		<Button
			className="ml-3"
			onClick={handlePublish}
			type="button"
			variant="default"
		>
			{label}
		</Button>
	);
};

export default PublishButton;
