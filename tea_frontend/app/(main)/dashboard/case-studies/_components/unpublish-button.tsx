'use client'

import { deleteCaseStudy, updateCaseStudy } from '@/actions/caseStudies'
import { AlertModal } from '@/components/modals/alertModal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { CloudDownloadIcon, Trash2Icon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

interface UnpublishCaseButtonProps {
  caseStudyId: number
}

const UnpublishCaseButton = ({ caseStudyId } : UnpublishCaseButtonProps) => {
  const { data } = useSession()
  const { toast } = useToast()

  const [alertOpen, setAlertOpen] = useState(false)
  const [alertLoading, setAlertLoading] = useState<boolean>(false)

  const handleUnpublish = async () => {
    try {
      const formData = new FormData();
      formData.append('id', caseStudyId.toString());

      formData.append("published", "false"); // Convert boolean to string
      formData.append("published_date", ""); // Clear the published date

      // Send the formData to the API
      const response = await updateCaseStudy(data?.key, formData);

      if (response) {
        toast({
          title: 'Successfully Unpublished',
          description: `You have unpublished your case study!`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Unpublish",
          description: "Sorry something went wrong!",
        });
      }
    } catch (error) {
      console.log(error)

      toast({
        variant: "destructive",
        title: "Failed to Unpublish",
        description: "Sorry something went wrong!",
      });
    } finally {
      setAlertOpen(false)
    }
  };

  return (
    <div>
      <div className='flex items-center hover:cursor-pointer' onClick={() => setAlertOpen(true)}>
        <CloudDownloadIcon className='size-4 mr-2'/>
        Unpublish
      </div>
      <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={handleUnpublish}
        loading={alertLoading}
        message={'Are you sure you want to unpublish this case study?'}
        confirmButtonText={'Yes, unpublish case study!'}
        cancelButtonText={'No'}
      />
    </div>
  )
}

export default UnpublishCaseButton
