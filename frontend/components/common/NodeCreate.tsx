'use client'

import { useEffect, useState } from "react";
import CreateSheet from "../ui/create-sheet";
import CreateForm from "./CreateForm";

interface NodeCreateProps {
  isOpen: boolean
  onClose: () => void
}

const NodeCreate = ({ isOpen, onClose } : NodeCreateProps ) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <CreateSheet 
      isOpen={isOpen} onClose={onClose}
    >
      <CreateForm onClose={onClose} />
    </CreateSheet>
  )
}

export default NodeCreate
