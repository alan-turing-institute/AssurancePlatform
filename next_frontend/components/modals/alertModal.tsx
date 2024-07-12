"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  message?: string
  confirmButtonText: string
  cancelButtonText?: string | null
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading,
  message,
  confirmButtonText,
  cancelButtonText
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      title="Are you sure?"
      description={message ? message : "This action cannot be undone."}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="pt-6 space-x-2 flex items-center justify-end w-full">
        <Button disabled={loading} variant="outline" onClick={onClose}>
          {cancelButtonText ? cancelButtonText : 'Cancel'}
        </Button>
        <Button disabled={loading} variant="destructive" onClick={onConfirm}>
          {loading ? 'Deleting' : confirmButtonText}
        </Button>
      </div>
    </Modal>
  );
};
