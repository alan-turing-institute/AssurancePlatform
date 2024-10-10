import React from 'react'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Textarea } from "../ui/textarea"
import { Button } from '../ui/button'
import { Goal } from 'lucide-react'
import useStore from '@/data/store';
import { useLoginToken } from '@/hooks/useAuth'

const formSchema = z.object({
  note: z.string().min(2, {
    message: "Note must be atleast 2 characters"
  })
})

interface NotesFormProps {
};

const NotesForm: React.FC<NotesFormProps> = ({ }) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase, caseNotes, setCaseNotes } = useStore();
  const [token] = useLoginToken();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      note: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/comments/`

        const requestOptions: RequestInit = {
            method: "POST",
            headers: {
                Authorization: `Token ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                content: values.note,
                assurance_case: assuranceCase.id,
            })
        };
        const response = await fetch(url, requestOptions);

        if(!response.ok) {
            console.log('error')
        }

        const result = await response.json()

        const newCaseNotes = [...caseNotes, result]
        setCaseNotes(newCaseNotes)

        // const updatedComments = [ ...assuranceCase.comments, result ]
        // const updatedAssuranceCase = {
        //   ...assuranceCase,
        //   comments: updatedComments
        // }

        // setAssuranceCase(updatedAssuranceCase)


        form.setValue('note', '')
    } catch (error) {
        console.log('Error', error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Note</FormLabel>
              <FormControl>
                <Textarea placeholder="Type your note here." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex justify-start items-center gap-3'>
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">Add Note</Button>
        </div>
      </form>
    </Form>
  )
}

export default NotesForm
