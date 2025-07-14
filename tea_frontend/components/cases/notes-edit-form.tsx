'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
// import { useLoginToken } from '.*/use-auth'
import useStore from '@/data/store';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/use-toast';

type NotesEditFormProps = {
  note: any;
  setEdit: Dispatch<SetStateAction<boolean | undefined>>;
};

const formSchema = z.object({
  comment: z.string().min(2).max(500),
});

const NotesEditForm = ({ note, setEdit }: NotesEditFormProps) => {
  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const { assuranceCase, setAssuranceCase, caseNotes, setCaseNotes } =
    useStore();
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const { id, content } = note;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: content,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const newComment = {
      content: values.comment,
    };

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${id}/`;

      const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newComment),
      };
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Failed to update comment',
          description: 'Something went wrong trying to update the comment.',
        });
        return;
      }

      const updatedComment = await response.json();

      // Find the index of the updated comment in the existing comments array
      const updatedComments = caseNotes.map((comment: any) =>
        comment.id === updatedComment.id ? updatedComment : comment
      );

      setCaseNotes(updatedComments);
      setEdit(false);
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update comment',
        description: 'Something went wrong trying to update the comment.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              {/* <FormLabel>Username</FormLabel> */}
              <FormControl>
                <Textarea placeholder="Type your message here." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-end gap-2">
          <Button onClick={() => setEdit(false)} variant={'ghost'}>
            Cancel
          </Button>
          <Button disabled={loading} type="submit">
            {loading ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default NotesEditForm;
