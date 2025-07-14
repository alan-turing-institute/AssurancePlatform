'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
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
// import { useLoginToken } from '@/hooks/useAuth'
import useStore from '@/data/store';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/use-toast';

type CommentsEditFormProps = {
  node: any;
  comment: any;
  setEdit: Dispatch<SetStateAction<boolean>>;
};

const formSchema = z.object({
  comment: z.string().min(2).max(500),
});

const CommentsEditForm = ({
  node,
  comment,
  setEdit,
}: CommentsEditFormProps) => {
  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const { assuranceCase, setAssuranceCase, nodeComments, setNodeComments } =
    useStore();
  const [loading, setLoading] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null); // Ref for the textarea

  const { id: commentId, content } = comment;
  const { toast } = useToast();

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
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${commentId}/`;

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
      const updatedComments = nodeComments.map((comment: any) =>
        comment.id === updatedComment.id ? updatedComment : comment
      );

      setNodeComments(updatedComments);
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

  // Function to adjust the textarea height dynamically
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset the height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set the height to match content
    }
  };

  // Resize the textarea when the content or the form loads
  useEffect(() => {
    autoResizeTextarea(); // Initial resize
  }, [autoResizeTextarea]); // Re-run when the comment changes

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Type your message here."
                  {...field}
                  onInput={autoResizeTextarea}
                  ref={(e) => {
                    field.ref(e); // Integrate with react-hook-form
                    textareaRef.current = e; // Set the local ref
                  }} // Auto-resize on input
                  style={{ overflow: 'hidden' }} // Hide scrollbars
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            className={'hover:bg-indigo-800/50'}
            onClick={() => setEdit(false)}
            variant={'ghost'}
          >
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

export default CommentsEditForm;
