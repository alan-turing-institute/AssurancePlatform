'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { saveAs } from 'file-saver';
import {
  ArrowUpRight,
  Download,
  FileIcon,
  Share2,
  Share2Icon,
  UploadIcon,
  User2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { neatJSON } from 'neatjson';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
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
import { Modal } from '@/components/ui/modal';
import useStore from '@/data/store';
import { useShareModal } from '@/hooks/use-share-modal';
// import { unauthorized, useLoginToken } from ".*/use-auth";
import type { User } from '@/types';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { useToast } from '../ui/use-toast';
import { LinkedCaseModal } from './linked-case-modal';

type ShareItem = {
  email: string;
  view?: boolean;
  edit?: boolean;
  review?: boolean;
};

type ShareItemArray = ShareItem[];

const FormSchema = z.object({
  email: z
    .string()
    .min(2, {
      message: 'Email must be at least 2 characters.',
    })
    .email(),
  accessLevel: z.string().min(1),
});

export const ShareModal = () => {
  const {
    assuranceCase,
    viewMembers,
    setViewMembers,
    editMembers,
    setEditMembers,
    reviewMembers,
    setReviewMembers,
  } = useStore();
  const shareModal = useShareModal();

  const [loading, setLoading] = useState(false);
  const [_isDisabled, _setIsDisabled] = useState(false);
  const [error, _setError] = useState<string>('');
  const [successMessage, _setSuccessMessage] = useState<string>('');
  const [_users, _setUsers] = useState<User[]>([]);
  const [_selectedUsers, _setSelectedUsers] = useState<User[]>([]);

  const [isLinkedCaseModalOpen, setIsLinkedCaseModalOpen] = useState(false);
  const [linkedCaseStudies, setLinkedCaseStudies] = useState([]);

  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const _router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: '',
      accessLevel: 'Read',
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setLoading(true);
    const payload: ShareItemArray = [];

    const newShareItem: ShareItem = { email: data.email };

    switch (data.accessLevel) {
      case 'Read':
        newShareItem.view = true;
        break;
      case 'Edit':
        newShareItem.edit = true;
        break;
      case 'Reviewer':
        newShareItem.review = true;
        break;
      default:
        // Default to view access
        newShareItem.view = true;
        break;
    }

    // if(data.accessLevel === 'Edit') {
    //   newShareItem.edit = true
    // } else {
    //   newShareItem.view = true
    // }

    payload.push(newShareItem);

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/sharedwith`;

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
          title: 'Unable to share case',
          description:
            'The email is not registered to an active user of the TEA platform.',
        });

        setLoading(false);
        return;
      }

      // const result = await response.json();
      // console.log("Shared Result", result);

      toast({
        variant: 'success',
        title: 'Shared Case with:',
        description: `${data.email}`,
      });

      if (newShareItem.view) {
        setViewMembers([...viewMembers, newShareItem]);
      }
      if (newShareItem.edit) {
        setEditMembers([...editMembers, newShareItem]);
      }
      if (newShareItem.review) {
        setReviewMembers([...reviewMembers, newShareItem]);
      }

      form.reset();
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong',
      });
    }

    setLoading(false);
  };

  const handleExport = () => {
    setLoading(true);

    let json = neatJSON(assuranceCase, {});
    // Remove the `id` fields, since they are only meaningful to the backend, and might
    // confuse it when importing the JSON exported here.
    json = json.replaceAll(/"id":\d+(,)?/g, '');

    const name = assuranceCase.name;

    // Write to a file, which to the user shows as a download.
    const blob = new Blob([json], {
      type: 'text/plain;charset=utf-8',
    });

    const now = new Date();
    // Using a custom date format because the ones that Date offers are either very long
    // or include characters not allowed in filenames on Windows.
    const datestr =
      now.getFullYear() +
      '-' +
      now.getMonth() +
      '-' +
      now.getDate() +
      'T' +
      now.getHours() +
      '-' +
      now.getMinutes() +
      '-' +
      now.getSeconds();
    const filename = `${name}-${datestr}.json`;
    saveAs(blob, filename);
    setLoading(false);
  };

  const handlePublish = async () => {
    try {
      const newData = {
        published: true,
        published_date: new Date().toISOString(),
      };
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`;
      const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newData),
      };

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        toast({ title: 'Something went wrong, publishing assurance case' });
        return;
      }

      window.location.reload();
    } catch (_error) {
      // Error handling for publish operation
    }
  };

  const handleUnpublish = async () => {
    try {
      const newData = {
        published: false,
        published_date: null,
      };
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`;
      const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newData),
      };

      const response = await fetch(url, requestOptions);

      // if (!response.ok) {
      //   let errorMessage = 'Something went wrong, unpublishing assurance case';

      //   try {
      //     const contentType = response.headers.get("content-type");
      //     if (contentType && contentType.includes("application/json")) {
      //       const errorData = await response.json();
      //       console.log(errorData);
      //       errorMessage = errorData.error || errorMessage;
      //     } else {
      //       const text = await response.text();
      //       console.log(text);
      //       errorMessage = text || errorMessage;
      //     }
      //   } catch (err) {
      //     console.error('Error parsing response', err);
      //   }

      //   toast({ title: 'Failed to Unpublish', description: errorMessage });
      //   return;
      // }

      if (!response.ok) {
        let errorMessage = 'Something went wrong, unpublishing assurance case';
        let linkedCases: unknown[] = [];

        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            linkedCases = errorData.linked_case_studies || [];
            setLinkedCaseStudies(linkedCases);
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch (_err) {
          // Error parsing response
        }

        shareModal.onClose();

        toast({
          title: 'Failed to Unpublish',
          description: (
            <div className="space-y-4">
              <p>{errorMessage}</p>
              {linkedCases.length > 0 && (
                <Button
                  onClick={() => setIsLinkedCaseModalOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  View linked case studies{' '}
                  <ArrowUpRight className="ml-2 size-4" />
                </Button>
              )}
            </div>
          ),
        });

        return;
      }

      window.location.reload();
    } catch (_error) {
      // Error handling for unpublish operation
    }
  };

  // Remove empty useEffect
  // useEffect(() => {}, []);

  return (
    <>
      <Modal
        description="How would you like the share your assurance case?"
        isOpen={shareModal.isOpen}
        onClose={shareModal.onClose}
        title="Share / Export Case"
      >
        {error && (
          <div className="flex w-full items-center justify-start gap-2 rounded-md border-2 border-rose-700 bg-rose-500/20 px-3 py-1 text-rose-600">
            <UserX className="h-4 w-4" />
            {error}
          </div>
        )}
        {successMessage && (
          <div className="flex w-full items-center justify-start gap-2 rounded-md border-2 border-emerald-700 bg-emerald-500/20 px-3 py-1 text-emerald-600">
            <UserCheck className="h-4 w-4" />
            {successMessage}
          </div>
        )}
        {assuranceCase && assuranceCase.permissions === 'manage' && (
          <div className="my-4 space-y-2">
            <h2 className="flex items-center justify-start gap-2">
              <User2 className="h-4 w-4" /> Share with users
            </h2>
            <Form {...form}>
              <form
                className="w-full space-y-6"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hidden">Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter email address"
                          {...field}
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessLevel"
                  render={({ field }) => (
                    <FormItem className="pb-2">
                      <FormLabel>Access Level</FormLabel>
                      <FormControl>
                        <RadioGroup
                          className="flex items-center justify-start space-x-2"
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormItem
                            className="flex items-center space-x-3 space-y-0"
                            key={crypto.randomUUID()}
                          >
                            <FormControl>
                              <RadioGroupItem value={'Read'} />
                            </FormControl>
                            <FormLabel className="font-normal">Read</FormLabel>
                          </FormItem>
                          <FormItem
                            className="flex items-center space-x-3 space-y-0"
                            key={crypto.randomUUID()}
                          >
                            <FormControl>
                              <RadioGroupItem value={'Edit'} />
                            </FormControl>
                            <FormLabel className="font-normal">Edit</FormLabel>
                          </FormItem>
                          <FormItem
                            className="flex items-center space-x-3 space-y-0"
                            key={crypto.randomUUID()}
                          >
                            <FormControl>
                              <RadioGroupItem value={'Reviewer'} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Reviewer
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button disabled={loading} type="submit">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </form>
            </Form>
          </div>
        )}
        <Separator />
        <div className="my-4">
          <h2 className="mb-2 flex items-center justify-start gap-2">
            <FileIcon className="h-4 w-4" />
            Export as JSON
          </h2>
          <p className="text-muted-foreground text-sm">
            Select the button below to download a JSON file.
          </p>
          <Button className="my-2" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Download File
          </Button>
        </div>
        {assuranceCase && assuranceCase.permissions === 'manage' && (
          <>
            <Separator />
            <div className="my-4">
              <h2 className="mb-2 flex items-center justify-start gap-2">
                <Share2Icon className="h-4 w-4" />
                Publish Assurance Case
              </h2>
              <p className="mb-2 text-muted-foreground text-sm">
                Here you can publish the current version of your case.
              </p>
              {assuranceCase?.published ? (
                <div className="flex items-center justify-start gap-4">
                  <Button
                    className="my-2"
                    onClick={handlePublish}
                    variant={'secondary'}
                  >
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Update
                  </Button>
                  <Button
                    className="my-2"
                    onClick={handleUnpublish}
                    variant={'destructive'}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Unpublish
                  </Button>
                </div>
              ) : (
                <Button
                  className="my-2 bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={handlePublish}
                >
                  <Share2Icon className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      <LinkedCaseModal
        isOpen={isLinkedCaseModalOpen}
        linkedCaseStudies={linkedCaseStudies}
        loading={false}
        onClose={() => setIsLinkedCaseModalOpen(false)} // or your loading state
      />
    </>
  );
};
