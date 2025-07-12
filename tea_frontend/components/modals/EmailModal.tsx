"use client";

import { Modal } from "@/components/ui/modal";
import { useRouter } from "next/navigation";
import { useEmailModal } from "@/hooks/useEmailModal";
import { Button } from "../ui/button";
import { MoveRightIcon } from "lucide-react";


export const EmailModal = () => {
  const emailModal = useEmailModal();

  const router = useRouter()

  const hanleRedirect = () => {
    emailModal.onClose()
    router.push('/dashboard/settings')
  }

  return (
    <Modal
      title="Missing Email Address"
      description="To use the TEA platform collaboration features, we require your email address. Please update your profile in the Settings page."
      isOpen={emailModal.isOpen}
      onClose={emailModal.onClose}
    >
      <div className="mt-4 flex justify-start items-center gap-2">
        <Button onClick={hanleRedirect} className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0">Go to settings <MoveRightIcon className="w-4 h-4 ml-2"/></Button>
        <Button variant={"outline"} onClick={() => emailModal.onClose()}>Cancel</Button>
      </div>
    </Modal>
  );
};
