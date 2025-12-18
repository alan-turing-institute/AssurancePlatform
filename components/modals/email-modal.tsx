"use client";

import { MoveRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useEmailModal } from "@/hooks/use-email-modal";
import { Button } from "../ui/button";

export const EmailModal = () => {
	const emailModal = useEmailModal();

	const router = useRouter();

	const hanleRedirect = () => {
		emailModal.onClose();
		router.push("/dashboard/settings");
	};

	return (
		<Modal
			description="To use the TEA platform collaboration features, we require your email address. Please update your profile in the Settings page."
			isOpen={emailModal.isOpen}
			onClose={emailModal.onClose}
			title="Missing Email Address"
		>
			<div className="mt-4 flex items-center justify-start gap-2">
				<Button
					className="focus-visible:outline-hidden focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0"
					onClick={hanleRedirect}
				>
					Go to settings <MoveRightIcon className="ml-2 h-4 w-4" />
				</Button>
				<Button onClick={() => emailModal.onClose()} variant={"outline"}>
					Cancel
				</Button>
			</div>
		</Modal>
	);
};
