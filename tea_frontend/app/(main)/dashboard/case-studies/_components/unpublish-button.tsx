'use client';

import { CloudDownloadIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React, { useState } from 'react';
import { deleteCaseStudy, updateCaseStudy } from '@/actions/caseStudies';
import { AlertModal } from '@/components/modals/alertModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface UnpublishCaseButtonProps {
  caseStudyId: number;
}

const UnpublishCaseButton = ({ caseStudyId }: UnpublishCaseButtonProps) => {
  const { data } = useSession();
  const { toast } = useToast();

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLoading, setAlertLoading] = useState<boolean>(false);

  const handleUnpublish = async () => {
    try {
      const formData = new FormData();
      formData.append('id', caseStudyId.toString());

      formData.append('published', 'false'); // Convert boolean to string
      formData.append('published_date', ''); // Clear the published date

      // Send the formData to the API
      const response = await updateCaseStudy(data?.key, formData);

      if (response) {
        toast({
          title: 'Successfully Unpublished',
          description: 'You have unpublished your case study!',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Unpublish',
          description: 'Sorry something went wrong!',
        });
      }
    } catch (error) {
      console.log(error);

      toast({
        variant: 'destructive',
        title: 'Failed to Unpublish',
        description: 'Sorry something went wrong!',
      });
    } finally {
      setAlertOpen(false);
    }
  };

  return (
    <div>
      <div
        className="flex items-center hover:cursor-pointer"
        onClick={() => setAlertOpen(true)}
      >
        <CloudDownloadIcon className="mr-2 size-4" />
        Unpublish
      </div>
      <AlertModal
        cancelButtonText={'No'}
        confirmButtonText={'Yes, unpublish case study!'}
        isOpen={alertOpen}
        loading={alertLoading}
        message={'Are you sure you want to unpublish this case study?'}
        onClose={() => setAlertOpen(false)}
        onConfirm={handleUnpublish}
      />
    </div>
  );
};

export default UnpublishCaseButton;
