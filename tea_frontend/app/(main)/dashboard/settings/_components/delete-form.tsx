'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { AlertModal } from '@/components/modals/alertModal';
import { useToast } from '@/components/ui/use-toast';
import type { DeleteFormProps } from '@/types/domain';

export const DeleteForm = ({ user }: DeleteFormProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, _setDeleteLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();

  const notifyError = (message: string) => {
    toast({
      variant: 'destructive',
      title: 'Uh oh! Something went wrong.',
      description: message,
    });
  };

  const handleDeleteUser = async () => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/users/${user.id}/`;

      const requestOptions: RequestInit = {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${session?.key}`,
        },
      };

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        notifyError('Something went wrong');
        return;
      }

      // setToken(null);
      router.push('/login');
    } catch (_error) {
      // Silently handle error
    }
    setDeleteOpen(false);
  };

  return (
    <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 className="font-semibold text-base text-foreground leading-7">
          Delete account
        </h2>
        <p className="mt-1 text-gray-400 text-sm leading-6">
          No longer want to use our service? You can delete your account here.
          This action is not reversible. All information related to this account
          will be deleted permanently.
        </p>
      </div>

      <form className="flex items-start md:col-span-2">
        <button
          className="rounded-md bg-red-500 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-red-400"
          onClick={(e) => {
            e.preventDefault();
            setDeleteOpen(true);
          }}
          type="submit"
        >
          Yes, delete my account
        </button>
      </form>

      <AlertModal
        cancelButtonText={'No, keep my account'}
        confirmButtonText={'Yes, delete my account!'}
        isOpen={deleteOpen}
        loading={deleteLoading}
        message={
          'Are you sure you want to delete your account? This will sign you out immediatley.'
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
};
