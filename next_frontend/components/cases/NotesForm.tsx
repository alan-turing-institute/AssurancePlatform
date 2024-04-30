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
  notes: any[]
  setNotes: (value: any[]) => void
};

const NotesForm: React.FC<NotesFormProps> = ({ notes, setNotes }) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  const [token] = useLoginToken();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      note: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setNotes([...notes, {
      id: crypto.randomUUID(),
      type: 'comment',
      person: { name: 'System User', href: '#' },
      imageUrl:
        'https://images.unsplash.com/photo-1520785643438-5bf77931f493?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80',
      comment: values.note,
      date: new Date(),
    }])
    form.setValue('note', '')
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
