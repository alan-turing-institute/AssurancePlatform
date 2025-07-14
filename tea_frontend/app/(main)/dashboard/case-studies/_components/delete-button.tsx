'use client';

import { Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { deleteCaseStudy } from '@/actions/case-studies';
import { AlertModal } from '@/components/modals/alertModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface DeleteCaseButtonProps {
  caseStudyId: number;
  variant: 'link' | 'destructive';
  redirect?: boolean;
}

const DeleteCaseButton = ({
  caseStudyId,
  variant,
  redirect = false,
}: DeleteCaseButtonProps) => {
  const { data } = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, _setDeleteLoading] = useState<boolean>(false);

  const handleDelete = async () => {
    const deleted = await deleteCaseStudy(data?.key ?? '', caseStudyId);

    if (deleted) {
      toast({
        title: 'Successfully Deleted',
        description: 'Case Study Deleted',
      });
      redirect ? router.push('/dashboard/case-studies') : null;
    } else {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Something went wrong!',
      });
    }
  };

  return (
    <div>
      {variant === 'destructive' && (
        <Button
          onClick={() => setDeleteOpen(true)}
          type="button"
          variant={variant}
        >
          <Trash2Icon className="mr-2 size-4" />
          Delete
        </Button>
      )}
      {variant === 'link' && (
        <button
          className="flex items-center"
          onClick={() => setDeleteOpen(true)}
          type="button"
        >
          <Trash2Icon className="mr-2 size-4" />
          Delete
        </button>
      )}
      <AlertModal
        cancelButtonText={'No'}
        confirmButtonText={'Yes, remove case study!'}
        isOpen={deleteOpen}
        loading={deleteLoading}
        message={'Are you sure you want to delete this case study?'}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default DeleteCaseButton;
