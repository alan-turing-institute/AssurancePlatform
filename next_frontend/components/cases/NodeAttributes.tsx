'use client'

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
import { updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'
import { useSession } from 'next-auth/react'
import { MinusIcon, PlusIcon } from 'lucide-react'

const formSchema = z.object({
  assumption: z.string().optional(),
  justification: z.string().optional()
})

interface NodeAttributesProps {
  node: any;
  actions: any
  onClose: () => void
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>
};

const NodeAttributes: React.FC<NodeAttributesProps> = ({
  node,
  actions,
  onClose,
  setUnresolvedChanges
}) => {
  const { assuranceCase, setAssuranceCase } = useStore();
  const { data: session } = useSession()
  const [loading, setLoading] = useState<boolean>(false)
  const [newAssumption, setNewAssumption] = useState<boolean>(false)
  const [newJustification, setNewJustification] = useState<boolean>(false)

  const { setSelectedLink, setAction } = actions

  const reset = () => {
    setSelectedLink(false)
    setAction('')
  }

  const handleCancel = () => {
    form.reset(); // Reset the form state
    reset(); // Perform additional reset actions
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: node.data || {
      assumption: '',
      justification: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    // Update item via api
    const updateItem = {
      assumption: values.assumption,
      justification: values.justification,
    }

    const updated = await updateAssuranceCaseNode(node.type, node.data.id, session?.key ?? '', updateItem)

    if(updated) {
      // Assurance Case Update
      const updatedAssuranceCase = await updateAssuranceCase(node.type, assuranceCase, updateItem, node.data.id, node)
      if(updatedAssuranceCase) {
        setAssuranceCase(updatedAssuranceCase)
        setLoading(false)
        onClose()
      }
    }
  }

  let readOnly = (assuranceCase.permissions === 'view' || assuranceCase.permissions === 'review') ? true : false

  // useEffect(() => {
  //   form.watch((values, { name }) => {
  //     if (name === 'assumption') {
  //       setUnresolvedChanges(true);
  //     }
  //   });
  // }, [form.watch, setUnresolvedChanges]);

  return (
    <div className='my-4 border-t'>
      <div className='mt-4 font-medium text-muted-foreground text-sm'>
        Please use this section to manage attributes for this element.
      </div>

      <div className='mt-4 flex justify-start items-center gap-2'>
        {!node.data.assumption && (
          <Button
            variant={'outline'}
            size={'sm'}
            onClick={() => setNewAssumption(!newAssumption)}
          >
            {newAssumption ? <MinusIcon className='size-3 mr-2' /> : <PlusIcon className='size-3 mr-2' />}
            Assumption
          </Button>
        )}
        {!node.data.justification && node.type === 'strategy' && (
          <Button
            variant={'outline'}
            size={'sm'}
            onClick={() => setNewJustification(!newJustification)}
          >
            {newJustification ? <MinusIcon className='size-3 mr-2' /> : <PlusIcon className='size-3 mr-2' />}
            Justification
          </Button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 my-4">
          {(node.data.assumption || newAssumption) && (
            <FormField
              control={form.control}
              name="assumption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assumption</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Type your assumption here." rows={5} {...field} readOnly={readOnly}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {node.type === 'strategy' && (node.data.justification || newJustification) && (
            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justification</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Type your justification here." rows={5} {...field} readOnly={readOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className='flex justify-start items-center gap-3 pt-4'>
            <Button variant={"outline"} onClick={handleCancel}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-indigo-500 hover:bg-indigo-600 dark:text-white">
              {loading ? 'Saving...' : 'Update Attributes'}</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default NodeAttributes
