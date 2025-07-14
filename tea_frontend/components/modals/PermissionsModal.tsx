'use client';

import { Modal } from '@/components/ui/modal';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShareModal } from '@/hooks/useShareModal';
import { Separator } from '../ui/separator';
import {
  Download,
  Eye,
  FileIcon,
  MessageCircleMore,
  PencilRuler,
  Share2,
  Trash2,
  User2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { neatJSON } from 'neatjson';
import { saveAs } from 'file-saver';
import useStore from '@/data/store';
import { unauthorized, useLoginToken } from '@/hooks/useAuth';
import { User } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '../ui/use-toast';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { usePermissionsModal } from '@/hooks/usePermissionsModal';
import { useSession } from 'next-auth/react';

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

  const [loading, setLoading] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  // const [viewMembers, setViewMembers] = useState<any[]>([])
  // const [editMembers, setEditMembers] = useState<any[]>([])

  const params = useParams();
  const { caseId } = params;

  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const router = useRouter();
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

    if (response.status === 401) return unauthorized();

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

      let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${caseId}/sharedwith`;

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
        console.log(`Something went wrong ${response.status}`);

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
    } catch (error) {
      console.log('Error', error);

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
  }, [assuranceCase]);

  return (
    <Modal
      title="Permissions"
      description="Manage who has access to the current assurance case."
      isOpen={permissionModal.isOpen}
      onClose={permissionModal.onClose}
    >
      <p className="uppercase text-xs mb-2 flex justify-start items-center gap-2 text-slate-300">
        <PencilRuler className="w-4 h-4" />
        Edit members
      </p>
      <Separator />

      <div className="my-4">
        {editMembers.length > 0 ? (
          editMembers.map((member: any) => (
            <div
              key={member.id}
              className="flex justify-start items-center gap-4 p-1 px-3 rounded-md  hover:cursor-pointer group"
            >
              <User2 className="w-4 h-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button
                onClick={() => handleRemovePermissions(member, 'edit')}
                size={'icon'}
                variant={'ghost'}
                className="hover:bg-rose-500 dark:hover:bg-rose-700/50 hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>

      <p className="uppercase text-xs mb-2 flex justify-start items-center gap-2 text-slate-300">
        <MessageCircleMore className="w-4 h-4" />
        Review members
      </p>
      <Separator />

      <div className="my-4">
        {reviewMembers.length > 0 ? (
          reviewMembers.map((member: any) => (
            <div
              key={member.id}
              className="flex justify-start items-center gap-4 p-1 px-3 rounded-md  hover:cursor-pointer group"
            >
              <User2 className="w-4 h-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button
                onClick={() => handleRemovePermissions(member, 'review')}
                size={'icon'}
                variant={'ghost'}
                className="hover:bg-rose-500 dark:hover:bg-rose-700/50 hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>

      <p className="uppercase text-xs mb-2 flex justify-start items-center gap-2 text-slate-300">
        <Eye className="w-4 h-4" />
        View members
      </p>
      <Separator />

      <div className="my-4">
        {viewMembers.length > 0 ? (
          viewMembers.map((member: any) => (
            <div
              key={member.id}
              className="flex justify-start items-center gap-4 p-1 px-3 rounded-md  hover:cursor-pointer group"
            >
              <User2 className="w-4 h-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button
                onClick={() => handleRemovePermissions(member, 'read')}
                size={'icon'}
                variant={'ghost'}
                className="hover:bg-rose-500 dark:hover:bg-rose-700/50 hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>
    </Modal>
  );
};
