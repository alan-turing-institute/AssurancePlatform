"use client";

import { CloudDownloadIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { updateCaseStudy } from "@/actions/case-studies";
import { AlertModal } from "@/components/modals/alert-modal";
import { useToast } from "@/components/ui/use-toast";

type UnpublishCaseButtonProps = {
	caseStudyId: number;
};

const UnpublishCaseButton = ({ caseStudyId }: UnpublishCaseButtonProps) => {
	const { data } = useSession();
	const { toast } = useToast();

	const [alertOpen, setAlertOpen] = useState(false);
	const [alertLoading, _setAlertLoading] = useState<boolean>(false);

	const handleUnpublish = async () => {
		try {
			const formData = new FormData();
			formData.append("id", caseStudyId.toString());

			formData.append("published", "false"); // Convert boolean to string
			formData.append("published_date", ""); // Clear the published date

			// Send the formData to the API
			const response = await updateCaseStudy(data?.key, formData);

			if (response) {
				toast({
					title: "Successfully Unpublished",
					description: "You have unpublished your case study!",
				});
			} else {
				toast({
					variant: "destructive",
					title: "Failed to Unpublish",
					description: "Sorry something went wrong!",
				});
			}
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Failed to Unpublish",
				description: "Sorry something went wrong!",
			});
		} finally {
			setAlertOpen(false);
		}
	};

	return (
		<div>
			<button
				className="flex items-center transition-colors"
				onClick={() => setAlertOpen(true)}
				type="button"
			>
				<CloudDownloadIcon className="mr-2 size-4" />
				Unpublish
			</button>
			<AlertModal
				cancelButtonText={"No"}
				confirmButtonText={"Yes, unpublish case study!"}
				isOpen={alertOpen}
				loading={alertLoading}
				message={"Are you sure you want to unpublish this case study?"}
				onClose={() => setAlertOpen(false)}
				onConfirm={handleUnpublish}
			/>
		</div>
	);
};

export default UnpublishCaseButton;
