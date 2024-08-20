'use client'

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
import {
  Form,
  FormControl,
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
import { Loader2, Lock } from 'lucide-react'
import { useLoginToken } from '@/hooks/useAuth'

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }).optional(),
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  })
})

interface CaseEditFormProps {
  onClose: () => void
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>
};

const CaseEditForm: React.FC<CaseEditFormProps> = ({
  onClose,
  setUnresolvedChanges
}) => {
  const { assuranceCase, setAssuranceCase } = useStore();
  const [token] = useLoginToken();
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: assuranceCase || {
      name: '',
      description: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    const updateItem = {
      name: values.name,
      description: values.description
    }

    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/`
    const requestOptions: RequestInit = {
        method: "PUT",
        headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(updateItem)
    }
    const response = await fetch(url, requestOptions);
    if(!response.ok) {
      console.log('Render a new error')
    }

    setLoading(false)
    setAssuranceCase({ ...assuranceCase, name: updateItem.name, description: updateItem.description })
    onClose()
  }

  useEffect(() => {
    form.watch((values, { name }) => {
      if (name === 'description' || name === 'name') {
        setUnresolvedChanges(true);
      }
    });
  }, [form.watch, setUnresolvedChanges]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className='flex justify-start items-center gap-2'>
                Name
                {assuranceCase.permissions !== 'manage' && (
                  <span className='flex justify-start items-center gap-2 text-xs text-muted-foreground py-2'><Lock className='w-3 h-3' /></span>
                )}
              </FormLabel>
              <FormControl>
                <Input {...field} readOnly={assuranceCase.permissions !== 'manage' ? true : false} />
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
              <FormLabel className='flex justify-start items-center gap-2'>
                Description
                {assuranceCase.permissions !== 'manage' && (
                  <span className='flex justify-start items-center gap-2 text-xs text-muted-foreground py-2'><Lock className='w-3 h-3' /></span>
                )}
              </FormLabel>
              <FormControl>
                <Textarea rows={8} {...field} readOnly={assuranceCase.permissions !== 'manage' ? true : false} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex justify-start items-center gap-3'>
        {assuranceCase.permissions === 'manage' && (
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 dark:text-white" disabled={loading}>
            {loading ? (
              <span className='flex justify-center items-center gap-2'><Loader2 className='w-4 h-4 animate-spin' />Updating...</span>
            ) : (
              <span>Update</span>
            )}
          </Button>
        )}
        </div>
      </form>
    </Form>
  )
}

export default CaseEditForm
