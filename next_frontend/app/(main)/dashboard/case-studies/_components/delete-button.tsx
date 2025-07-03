'use client'

import { deleteCaseStudy } from '@/actions/caseStudies'
import { AlertModal } from '@/components/modals/alertModal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Trash2Icon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

interface DeleteCaseButtonProps {
  caseStudyId: number
  variant: 'link' | 'destructive'
  redirect?: boolean
}

const DeleteCaseButton = ({ caseStudyId, variant, redirect = false } : DeleteCaseButtonProps) => {
  const { data } = useSession()
  const { toast } = useToast();
  const router = useRouter()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false)

  const handleDelete = async () => {
      const deleted = await deleteCaseStudy(data?.key!!, caseStudyId)

      if(deleted) {
        toast({
          title: 'Successfully Deleted',
          description: 'Case Study Deleted',
        });
        redirect ? router.push('/dashboard/case-studies') : null
      } else {
        toast({
          variant: "destructive",
          title: 'Delete Failed',
          description: 'Something went wrong!',
        });
      }
    }

  return (
    <div>
      {variant === 'destructive' && <Button variant={variant} onClick={() => setDeleteOpen(true)} type="button"><Trash2Icon className="size-4 mr-2"/>Delete</Button>}
      {variant === 'link' && <button onClick={() => setDeleteOpen(true)} type="button" className='flex items-center'><Trash2Icon className="size-4 mr-2"/>Delete</button>}
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message={'Are you sure you want to delete this case study?'}
        confirmButtonText={'Yes, remove case study!'}
        cancelButtonText={'No'}
      />
    </div>
  )
}

export default DeleteCaseButton
