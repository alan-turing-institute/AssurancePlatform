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

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  })
})

interface CreateFormProps {
  onClose: () => void
};

const CreateForm: React.FC<CreateFormProps> = ({ onClose }) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // TODO: This needs to be created at api 
    const newGoal = {
      "id": crypto.randomUUID(),
      "type": "goal",
      "name": values.name,
      "short_description": values.description,
      "long_description": "N/A",
      "keywords": "N/A",
      "assurance_case_id": assuranceCase.id,
      "context":[],
      "property_claims":[],
      "strategies":[]
    }

    console.log('New Goal', newGoal)

    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [ newGoal ]
    }

    setAssuranceCase(updatedAssuranceCase)

    onClose()
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
                <Input placeholder="Goal name" {...field} />
              </FormControl>
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
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600">Create Goal</Button>
        </div>
      </form>
    </Form>
  )
}

export default CreateForm
