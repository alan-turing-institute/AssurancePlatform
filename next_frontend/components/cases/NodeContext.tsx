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
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Textarea } from "../ui/textarea"
import { Button } from '../ui/button'
import useStore from '@/data/store';
// import { useLoginToken } from '@/hooks/useAuth'
import { addEvidenceToClaim, addHiddenProp, addPropertyClaimToNested, createAssuranceCaseNode, findItemById, findParentNode, findSiblingHiddenState, setNodeIdentifier, updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'
import { useSession } from 'next-auth/react'
import { Skeleton } from '../ui/skeleton'

const formSchema = z.object({
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  }).optional()
})

interface NodeContextProps {
  node: any;
  actions: any
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>
};

const NodeConext: React.FC<NodeContextProps> = ({
  node,
  actions,
  setUnresolvedChanges
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  const { data: session } = useSession()
  const [loading, setLoading] = useState<boolean>(false)

  const { setSelectedLink, setLinkToCreate, handleClose, setAction } = actions

  const reset = () => {
    setSelectedLink(false)
    setAction('')
  }

  const handleCancel = () => {
    form.reset(); // Reset the form state
    reset(); // Perform additional reset actions
  };

  /** Function used to handle creation of a context node linked to a goal */
  // const handleContextAdd = async (description: string) => {

  //   // Create a new context object to add - this should be created by calling the api
  //   const newContextItem = {
  //     "short_description": description,
  //     "long_description": description,
  //     "goal_id": assuranceCase.goals[0].id,
  //     "type": "Context"
  //   };

  //   const result: any = await createAssuranceCaseNode('contexts', newContextItem, session?.key ?? '')

  //   if(result.error) {
  //     // TODO: Rendering error
  //   }

  //   result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id)

  //   console.log('RESULT', result)

  //   // Create a new context array by adding the new context item
  //   const newContext = [...assuranceCase.goals[0].context, result.data];

  //   // Create a new assuranceCase object with the updated context array
  //   const updatedAssuranceCase = {
  //     ...assuranceCase,
  //     goals: [
  //       {
  //         ...assuranceCase.goals[0],
  //         context: newContext
  //       }
  //     ]
  //   }

  //   // Update Assurance Case in state
  //   setAssuranceCase(updatedAssuranceCase)
  //   reset()
  //   setLoading(false)
  //   // window.location.reload()
  // }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  useEffect(() => {
    form.watch((values, { name }) => {
      if (name === 'description') {
        setUnresolvedChanges(true);
      }
    });
  }, [form.watch, setUnresolvedChanges]);

  const sampleContexts = [
    { description: 'Lorem ipsum 12344 dffsdf sdfsdfsdfsd sdfsfsfsdf sdfsdfsdf' },
    { description: 'Lorem ipsum 12344 dffsdf sdfsdfsdfsd sdfsfsfsdf sdfsdfsdf' },
    { description: 'Lorem ipsum 12344 dffsdf sdfsdfsdfsd sdfsfsfsdf sdfsdfsdf' },
    { description: 'Lorem ipsum 12344 dffsdf sdfsdfsdfsd sdfsfsfsdf sdfsdfsdf' },
    { description: 'Lorem ipsum 12344 dffsdf sdfsdfsdfsd sdfsfsfsdf sdfsdfsdf' },
  ]

  return (
    <div className='my-4 border-t'>
      <div className='mt-4 font-medium text-muted-foreground text-sm'>
        Please add a new context using thr form below.
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 my-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Type your description here." rows={10} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='flex justify-start items-center gap-3 pt-4'>
            <Button variant={"outline"} onClick={handleCancel}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-indigo-500 hover:bg-indigo-600 dark:text-white">Add Context</Button>
          </div>
        </form>
      </Form>

      <div className='mt-8 font-medium'>
        Existing Contexts
      </div>
      <p className='text-muted-foreground text-sm mb-4'>
        Please manage your contexts below
      </p>

      {loading ? (
        <div className='py-8 flex flex-col justify-start gap-2 w-full'>
          <Skeleton className="w-full h-[10px] rounded-full" />
          <Skeleton className="w-2/3 h-[10px] rounded-full" />
          <div className='flex justify-start items-center gap-2'>
            <Skeleton className="w-[20px] h-[10px] rounded-full" />
            <Skeleton className="w-[100px] h-[10px] rounded-full" />
          </div>
        </div>
      ) : (
        <div className='w-full mb-16 flex flex-col justify-start items-start gap-3'>
          {sampleContexts.map((item: any, index:number) => (
            <div key={index} className='p-3 text-foreground rounded-md w-full group hover:bg-indigo-500 hover:text-white transition-all duration-300 hover:cursor-pointer relative hover:pb-6'>
              <p className="whitespace-normal">{item.description}</p>
              {/* <div className='text-muted-foreground group-hover:text-white text-xs flex justify-start items-center gap-2 transition-all duration-300 mt-3'>
                <BookOpenText className='w-3 h-3'/>
                <div>
                  author?
                  <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                    <circle cx={1} cy={1} r={1} />
                  </svg>
                  identifier?
                </div>
              </div> */}
            </div>
          ))}
          </div>
      )}
    </div>
  )
}

export default NodeConext
