import React, { useState } from 'react'
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
  const { assuranceCase, setAssuranceCase } = useStore();
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

    const newComment = {
      content: values.comment
    }

    try {
        const createdComment = await addElementComment(node.type, node.id, newComment, token)

        // TODO: Add new comment to current comments for element
        // const updatedComments = [ ...assuranceCase.comments, createdComment ]

        // const updatedAssuranceCase = {
        //   ...assuranceCase,
        //   comments: updatedComments
        // }

        // TODO: Update Assurance Case with updated 
        // setAssuranceCase(updatedAssuranceCase)

        // Clear form input
        form.setValue('comment', '')
    } catch (error) {
        console.log('Error', error)
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
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Add Comment</Button>
        </div>
      </form>
    </Form>
  )
}

export default CommentsForm
