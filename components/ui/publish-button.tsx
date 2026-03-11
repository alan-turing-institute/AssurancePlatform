"use client";

import { updateCaseStudy } from "@/actions/case-studies";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type { CaseStudyResponse } from "@/lib/services/case-response-types";

type PublishButtonProps = {
	label: string;
	published: boolean;
	caseStudy: CaseStudyResponse;
};

const PublishButton = ({ label, published, caseStudy }: PublishButtonProps) => {
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
