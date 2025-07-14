import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import type React from 'react';
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
import useStore from '@/data/store';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  comment: z.string().min(2, {
    message: 'Comment must be atleast 2 characters',
  }),
});

interface CommentsFormProps {
  node: any;
}

const CommentsForm: React.FC<CommentsFormProps> = ({
  node,
}: CommentsFormProps) => {
  const { assuranceCase, setAssuranceCase, nodeComments, setNodeComments } =
    useStore();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const newComment = {
      content: values.comment,
    } as any;

    let entity = null;
    switch (node.type) {
      case 'context':
        entity = 'contexts';
        newComment.context = node.data.id;
        break;
      case 'strategy':
        entity = 'strategies';
        newComment.strategy = node.data.id;
        break;
      case 'property':
        entity = 'propertyclaims';
        newComment.property_claim = node.data.id;
        break;
      case 'evidence':
        entity = 'evidence';
        newComment.evidence = node.data.id;
        break;
      default:
        entity = 'goals';
        newComment.goal = node.data.id;
        break;
    }

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${node.data.id}/comments/`;

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newComment),
      };

      const response = await fetch(url, requestOptions);
      const result = await response.json();

      // **Update the comments as an array**
      const newCommentsList = [...nodeComments, result];

      setNodeComments(newCommentsList);

      // Clear form input
      form.setValue('comment', '');
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        className="mt-2 w-full space-y-8"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="hidden">New Comment</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Type your comment here."
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-start gap-3">
          <Button
            className="bg-indigo-500 text-white hover:bg-indigo-600"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CommentsForm;
