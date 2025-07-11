'use client'

import React, { Dispatch, SetStateAction, useState } from 'react'
import { boolean, z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from '../ui/textarea'
// import { useLoginToken } from '@/hooks/useAuth'
import useStore from '@/data/store'
import { useToast } from '../ui/use-toast'
import { useSession } from 'next-auth/react'

type NotesEditFormProps = {
  note: any,
  setEdit: Dispatch<SetStateAction<boolean | undefined>>
}

const formSchema = z.object({
  comment: z.string().min(2).max(500),
})

const NotesEditForm = ({ note, setEdit } : NotesEditFormProps ) => {
  // const [token] = useLoginToken();
  const { data: session } = useSession()
  const { assuranceCase, setAssuranceCase, caseNotes, setCaseNotes } = useStore()
  const [loading, setLoading] = useState<boolean>(false)
  const { toast } = useToast()

  const { id, content } = note

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: content,
    }
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)

    const newComment = {
      content: values.comment
    }

    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${id}/`

      const requestOptions: RequestInit = {
          method: "PUT",
          headers: {
              Authorization: `Token ${session?.key}`,
              "Content-Type": "application/json",
          },
          body: JSON.stringify(newComment),
      };
      const response = await fetch(url, requestOptions);

      if(!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Failed to update comment',
          description: 'Something went wrong trying to update the comment.',
        });
        return
      }

      const updatedComment = await response.json();

      // Find the index of the updated comment in the existing comments array
      const updatedComments = caseNotes.map((comment:any) =>
          comment.id === updatedComment.id ? updatedComment : comment
      );

      setCaseNotes(updatedComments);
      setEdit(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update comment',
        description: 'Something went wrong trying to update the comment.',
      });
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <div className='flex justify-end items-center gap-2'>
          <Button variant={'ghost'} onClick={() => setEdit(false)}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default NotesEditForm
