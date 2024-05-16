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
import useStore from '@/data/store';
import { CloudFog, LockIcon, LockKeyhole } from 'lucide-react'
import { getLayoutedElements } from '@/lib/layout-helper'
import { useLoginToken } from '@/hooks/useAuth'
import { findItemById, updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'

const formSchema = z.object({
  // name: z.string().min(2, {
  //   message: "Name must be at least 2 characters.",
  // }),
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  })
})

interface EditFormProps {
  node: any;
};

const EditForm: React.FC<EditFormProps> = ({
  node
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  const [token] = useLoginToken();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: node.data || {
      // name: '',
      description: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Update item via api
    const updateItem = {
      short_description: values.description
    }

    const updated = await updateAssuranceCaseNode(node.type, node.data.id, token, updateItem)

    if(updated) {
      // Assurance Case Update
      const updatedAssuranceCase = await updateAssuranceCase(node.type, assuranceCase, updateItem, node.data.id, node)
      if(updatedAssuranceCase) {
        setAssuranceCase(updatedAssuranceCase)
      }
    }

  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
        {/* <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Goal name" {...field} readOnly />
              </FormControl>
              <FormDescription className='flex justify-start items-center gap-2'>
                <LockKeyhole className='w-3 h-3'/> Read only field
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        /> */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Type your message here." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex justify-start items-center gap-3'>
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 dark:text-white">Update&nbsp;<span className='capitalize'>{node.type}</span></Button>
        </div>
      </form>
    </Form>
  )
}

export default EditForm
