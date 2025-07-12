"use client";

import { CaseCreateModal } from "@/components/modals/CaseCreateModal";
import { EmailModal } from "@/components/modals/EmailModal";
import { ImportModal } from "@/components/modals/ImportModal";
import { PermissionsModal } from "@/components/modals/PermissionsModal";
import { ResourcesModal } from "@/components/modals/ResourcesModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { useEffect, useState } from "react";

/**
 * ModalProvider component that renders several modals for different functionalities.
 *
 * This component manages the mounting state to prevent server-side rendering issues with modals in Next.js.
 * It uses a `useState` hook to track if the component is mounted and a `useEffect` hook to update this state after mounting.
 * The component returns `null` if it is not mounted yet to prevent any rendering issues.
 *
 * @returns {JSX.Element | null} The JSX for the modals when the component is mounted, or `null` if not mounted.
 */
export const ModalProvider = (): JSX.Element | null => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Set mounted state to true after the component is mounted
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Return null to prevent rendering modals during server-side rendering
    return null;
  }

  return (
    <>
      <CaseCreateModal />
      <ImportModal />
      <ShareModal />
      <PermissionsModal />
      <EmailModal />
      <ResourcesModal />
    </>
  );
};
