"use client";

import { CaseCreateModal } from "@/components/modals/CaseCreateModal";
import { EmailModal } from "@/components/modals/EmailModal";
import { ImportModal } from "@/components/modals/ImportModal";
import { PermissionsModal } from "@/components/modals/PermissionsModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { useEffect, useState } from "react";

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <CaseCreateModal />
      <ImportModal />
      <ShareModal />
      <PermissionsModal />
      <EmailModal />
    </>
  );
}
