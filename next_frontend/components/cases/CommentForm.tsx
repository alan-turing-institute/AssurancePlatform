import React, { Dispatch, SetStateAction, useState } from 'react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Textarea } from "../ui/textarea"
import { Button } from '../ui/button'
import useStore from '@/data/store';
import { useLoginToken } from '@/hooks/useAuth'
import { addElementComment } from '@/lib/case-helper'

const formSchema = z.object({
  comment: z.string().min(2, {
    message: "Comment must be atleast 2 characters"
  })
})

interface CommentsFormProps {
  node: any
};

const CommentsForm: React.FC<CommentsFormProps> = ({ node }: CommentsFormProps) => {
  const { assuranceCase, setAssuranceCase, nodeComments, setNodeComments } = useStore();
  const [token] = useLoginToken();
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
    setLoading(true)

    let newComment = {
      content: values.comment
    } as any

    let entity = null;
    switch (node.type) {
      case "context":
        entity = "contexts";
        newComment.context = node.data.id
        break;
      case "strategy":
        entity = "strategies";
        newComment.strategy = node.data.id
        break;
      case "property":
        entity = "propertyclaims";
        newComment.property_claim = node.data.id
        break;
      case "evidence":
        entity = "evidence";
        newComment.evidence = node.data.id
        break;
      default:
        entity = "goals";
        newComment.goal = node.data.id
        break;
    }

    try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${node.data.id}/comments/`;

        const requestOptions: RequestInit = {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newComment)
        };

        const response = await fetch(url, requestOptions);
        const result = await response.json()

        // **Update the comments as an array**
        const newCommentsList = [...nodeComments, result]

        setNodeComments(newCommentsList)

        // Clear form input
        form.setValue('comment', '')
    } catch (error) {
        console.log('Error', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-2 w-full">
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel className='hidden'>New Comment</FormLabel>
              <FormControl>
                <Textarea placeholder="Type your comment here." rows={5} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex justify-start items-center gap-3'>
          <Button type="submit" disabled={loading} className="bg-indigo-500 hover:bg-indigo-600 text-white">
            {loading ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default CommentsForm
