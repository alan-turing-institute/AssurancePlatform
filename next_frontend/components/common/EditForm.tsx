'use client'

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
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
import { CloudFog, Loader, Loader2, Lock, LockIcon, LockKeyhole } from 'lucide-react'
import { getLayoutedElements } from '@/lib/layout-helper'
// import { useLoginToken } from '@/hooks/useAuth'
import { findItemById, updateAssuranceCase, updateAssuranceCaseNode, caseItemDescription } from '@/lib/case-helper'
import { useSession } from 'next-auth/react'

const formSchema = z.object({
  URL: z.string().min(2, {
    message: "url must be at least 2 characters.",
  }).optional(),
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  }),
  assumption: z.string().optional(),
  justification: z.string().optional()
})

interface EditFormProps {
  node: any;
  onClose: () => void
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>
};

const EditForm: React.FC<EditFormProps> = ({
  node,
  onClose,
  setUnresolvedChanges
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  // const [token] = useLoginToken();
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: node.data || {
      URL: '',
      description: '',
      assumption: '',
      justification: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    // Update item via api
    const updateItem = {
      short_description: values.description,
      assumption: values.assumption,
      justification: values.justification
    }

    if(node.type === 'evidence') {
      //@ts-ignore
      updateItem.URL = values.URL
    }

    const updated = await updateAssuranceCaseNode(node.type, node.data.id, session?.key ?? '', updateItem)

    if(updated) {
      // Assurance Case Update
      const updatedAssuranceCase = await updateAssuranceCase(node.type, assuranceCase, updateItem, node.data.id, node)
      if(updatedAssuranceCase) {
        setAssuranceCase(updatedAssuranceCase)
        setLoading(false)
        // window.location.reload()
        onClose()
      }
    }

  }

  useEffect(() => {
    form.watch((values, { name }) => {
      if (name === 'description' || name === 'URL') {
        setUnresolvedChanges(true);
      }
    });
  }, [form.watch, setUnresolvedChanges]);

  let readOnly = (assuranceCase.permissions === 'view' || assuranceCase.permissions === 'review') ? true : false

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className='flex justify-start items-center gap-2'>
                Description
                {readOnly && (
                  <span title='Read Only' className='flex justify-start items-center gap-2 text-xs text-muted-foreground py-2'><Lock className='w-3 h-3' /></span>
                )}
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Type your message here." {...field}
                  readOnly={readOnly}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {node.type !== 'evidence' && (
          <FormField
            control={form.control}
            name="assumption"
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex justify-start items-center gap-2'>
                  Assumption
                  {readOnly && (
                    <span title='Read Only' className='flex justify-start items-center gap-2 text-xs text-muted-foreground py-2'><Lock className='w-3 h-3' /></span>
                  )}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="" {...field}
                    readOnly={readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {node.type !== 'evidence' && node.type === 'strategy' && (
          <FormField
            control={form.control}
            name="justification"
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex justify-start items-center gap-2'>
                  Justification
                  {readOnly && (
                    <span title='Read Only' className='flex justify-start items-center gap-2 text-xs text-muted-foreground py-2'><Lock className='w-3 h-3' /></span>
                  )}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="" {...field}
                    readOnly={readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {node.type === 'evidence' && (
          <FormField
            control={form.control}
            name="URL"
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex justify-start items-center gap-2'>
                  Evidence URL
                  {readOnly && (
                    <span title='Read Only' className='flex justify-start items-center gap-2 text-xs text-muted-foreground py-2'><Lock className='w-3 h-3' /></span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input placeholder="www.sample.com" {...field} readOnly={readOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className='flex justify-start items-center gap-3'>
        {!readOnly && (
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 dark:text-white" disabled={loading}>
            {loading ? (
              <span title='Read Only' className='flex justify-center items-center gap-2'><Loader2 className='w-4 h-4 animate-spin' />Updating...</span>
            ) : (
              <span>Update&nbsp;<span className='capitalize'>{caseItemDescription(node.type)}</span></span>
            )}
          </Button>
        )}
        </div>
      </form>
    </Form>
  )
}

export default EditForm
