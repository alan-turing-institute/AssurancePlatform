"use client";

import { CaseCreateModal } from "@/components/modals/CaseCreateModal";
import { ImportModal } from "@/components/modals/ImportModal";
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
    </>
  );
}
