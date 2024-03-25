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
import { shallow } from 'zustand/shallow';
import useStore from '@/data/store';
import { LockIcon, LockKeyhole } from 'lucide-react'

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  })
})

interface EditFormProps {
  node: any;
};

const selector = (state: any) => ({
  nodes: state.nodes,
  setNodes: state.setNodes
});

const EditForm: React.FC<EditFormProps> = ({
  node
}) => {
  const { nodes, setNodes } = useStore(selector, shallow);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: node.data || {
      name: '',
    }
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values)

    const nodeIndex = nodes.findIndex((n: any) => n.id === node.id);
    if (nodeIndex !== -1) {
      // Make a copy of the nodes array to avoid mutating state directly
      const updatedNodes = [...nodes];

      // Make changes to the node (for example, updating its data)
      updatedNodes[nodeIndex] = {
        ...updatedNodes[nodeIndex], // Copy the existing node properties
        data: {
          ...updatedNodes[nodeIndex].data, // Copy the existing node data properties
          // Update the specific property you want to change
          // For example:
          name: values.name,
          description: values.description
        }
      };

      // Update the nodes state in the store with the modified node
      setNodes(updatedNodes);
    }

  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
        <FormField
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
        />
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
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600">Update&nbsp;<span className='capitalize'>{node.type}</span></Button>
        </div>
      </form>
    </Form>
  )
}

export default EditForm
