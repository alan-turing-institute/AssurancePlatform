'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Blocks } from 'lucide-react';

interface LinkedCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkedCaseStudies: { id: number; title: string }[];
  loading: boolean;
}

export const LinkedCaseModal: React.FC<LinkedCaseModalProps> = ({
  isOpen,
  onClose,
  linkedCaseStudies,
  loading,
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
      title="Linked Case Studies"
      description="You cannot unpublish this assurance case because it is linked to these case studies."
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="max-h-60 overflow-y-auto mb-4">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {linkedCaseStudies.map((caseStudy) => (
            <li key={caseStudy.id}>
              <Link
                href={`/dashboard/case-studies/${caseStudy.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-500 hover:underline flex items-center gap-2"
              >
                <Blocks className="size-4" />
                {caseStudy.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-6 flex justify-end w-full space-x-2">
        <Button disabled={loading} variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
