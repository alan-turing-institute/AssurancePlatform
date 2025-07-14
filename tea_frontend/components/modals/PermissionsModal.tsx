'use client';

import {
  Eye,
  MessageCircleMore,
  PencilRuler,
  Trash2,
  User2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import useStore from '@/data/store';
import { unauthorized } from '@/hooks/useAuth';
import { usePermissionsModal } from '@/hooks/usePermissionsModal';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useToast } from '../ui/use-toast';

export const PermissionsModal = () => {
  const {
    assuranceCase,
    viewMembers,
    setViewMembers,
    editMembers,
    setEditMembers,
    reviewMembers,
    setReviewMembers,
  } = useStore();
  const permissionModal = usePermissionsModal();

  const [_loading, setLoading] = useState(false);
  const [_isDisabled, _setIsDisabled] = useState(false);
  const [_error, _setError] = useState<string>('');
  const [_successMessage, _setSuccessMessage] = useState<string>('');
  // const [viewMembers, setViewMembers] = useState<any[]>([])
  // const [editMembers, setEditMembers] = useState<any[]>([])

  const params = useParams();
  const { caseId } = params;

  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const _router = useRouter();
  const { toast } = useToast();

  const fetchCaseMembers = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${session?.key}`,
      },
    };

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${caseId}/sharedwith`,
      requestOptions
    );

    if (response.status === 401) {
      return unauthorized();
    }

    const result = await response.json();
    return result;
  };

  const handleRemovePermissions = async (member: any, level: string) => {
    try {
      setLoading(true);
      const payload = [];

      const item = {
        email: member.email,
        edit: false,
        view: false,
        review: false,
      };

      payload.push(item);

      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${caseId}/sharedwith`;

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      };
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Something went wrong',
        });

        setLoading(false);
        return;
      }

      if (level === 'read') {
        const removedMembers = viewMembers.filter(
          (item) => item.email !== member.email
        );
        setViewMembers(removedMembers);
      }

      if (level === 'edit') {
        const removedMembers = editMembers.filter(
          (item) => item.email !== member.email
        );
        setEditMembers(removedMembers);
      }

      if (level === 'review') {
        const removedMembers = reviewMembers.filter(
          (item) => item.email !== member.email
        );
        setReviewMembers(removedMembers);
      }
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong',
      });
    }
  };

  useEffect(() => {
    if (assuranceCase && assuranceCase.permissions === 'manage') {
      fetchCaseMembers().then((result) => {
        setViewMembers(result.view);
        setEditMembers(result.edit);
        setReviewMembers(result.review);
      });
    }
  }, [
    assuranceCase,
    fetchCaseMembers,
    setEditMembers,
    setReviewMembers,
    setViewMembers,
  ]);

  return (
    <Modal
      description="Manage who has access to the current assurance case."
      isOpen={permissionModal.isOpen}
      onClose={permissionModal.onClose}
      title="Permissions"
    >
      <p className="mb-2 flex items-center justify-start gap-2 text-slate-300 text-xs uppercase">
        <PencilRuler className="h-4 w-4" />
        Edit members
      </p>
      <Separator />

      <div className="my-4">
        {editMembers.length > 0 ? (
          editMembers.map((member: any) => (
            <div
              className="group flex items-center justify-start gap-4 rounded-md p-1 px-3 hover:cursor-pointer"
              key={member.id}
            >
              <User2 className="h-4 w-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button
                className="hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700/50"
                onClick={() => handleRemovePermissions(member, 'edit')}
                size={'icon'}
                variant={'ghost'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No members found.</p>
        )}
      </div>

      <p className="mb-2 flex items-center justify-start gap-2 text-slate-300 text-xs uppercase">
        <MessageCircleMore className="h-4 w-4" />
        Review members
      </p>
      <Separator />

      <div className="my-4">
        {reviewMembers.length > 0 ? (
          reviewMembers.map((member: any) => (
            <div
              className="group flex items-center justify-start gap-4 rounded-md p-1 px-3 hover:cursor-pointer"
              key={member.id}
            >
              <User2 className="h-4 w-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button
                className="hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700/50"
                onClick={() => handleRemovePermissions(member, 'review')}
                size={'icon'}
                variant={'ghost'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No members found.</p>
        )}
      </div>

      <p className="mb-2 flex items-center justify-start gap-2 text-slate-300 text-xs uppercase">
        <Eye className="h-4 w-4" />
        View members
      </p>
      <Separator />

      <div className="my-4">
        {viewMembers.length > 0 ? (
          viewMembers.map((member: any) => (
            <div
              className="group flex items-center justify-start gap-4 rounded-md p-1 px-3 hover:cursor-pointer"
              key={member.id}
            >
              <User2 className="h-4 w-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button
                className="hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700/50"
                onClick={() => handleRemovePermissions(member, 'read')}
                size={'icon'}
                variant={'ghost'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No members found.</p>
        )}
      </div>
    </Modal>
  );
};
