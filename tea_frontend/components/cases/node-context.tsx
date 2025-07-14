'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FolderXIcon } from 'lucide-react';
import moment from 'moment';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import useStore from '@/data/store';
// import { useLoginToken } from '@/hooks/useAuth'
import {
  createAssuranceCaseNode,
  deleteAssuranceCaseNode,
  getAssuranceCaseNode,
  removeAssuranceCaseNode,
} from '@/lib/case-helper';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  description: z
    .string()
    .min(2, {
      message: 'Description must be atleast 2 characters',
    })
    .optional(),
});

interface NodeContextProps {
  node: any;
  actions: any;
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

const NodeConext: React.FC<NodeContextProps> = ({
  node,
  actions,
  setUnresolvedChanges,
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  const { data: session } = useSession();
  const [contexts, setContexts] = useState<any>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // console.log('NODE', node)
  // console.log('Case', assuranceCase.goals[0])

  const { setSelectedLink, setLinkToCreate, handleClose, setAction } = actions;

  const reset = () => {
    setSelectedLink(false);
    setAction('');
  };

  const handleCancel = () => {
    form.reset(); // Reset the form state
    reset(); // Perform additional reset actions
  };

  /** Function used to handle creation of a context node linked to a goal */
  const handleContextAdd = async (description: string) => {
    // Create a new context object to add - this should be created by calling the api
    const newContextItem = {
      short_description: description,
      long_description: description,
      goal_id: node.data.id,
      type: 'Context',
    };

    const result: any = await createAssuranceCaseNode(
      'contexts',
      newContextItem,
      session?.key ?? ''
    );

    if (result.error) {
      // TODO: Rendering error
    }

    // Create a new context array by adding the new context item
    const newContext = [...assuranceCase.goals[0].context, result.data];

    // Create a new assuranceCase object with the updated context array
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          context: newContext,
        },
      ],
    };

    // Update Assurance Case in state
    setAssuranceCase(updatedAssuranceCase);
    form.reset();
  };

  /** Function used to handle deletion of a context node linked to a goal */
  const handleContextDelete = async (id: number) => {
    setLoading(true);
    const deleted = await deleteAssuranceCaseNode(
      'context',
      id,
      session?.key ?? ''
    );

    if (deleted) {
      const updatedAssuranceCase = await removeAssuranceCaseNode(
        assuranceCase,
        id,
        'context'
      );
      if (updatedAssuranceCase) {
        setAssuranceCase(updatedAssuranceCase);
        setLoading(false);
        // setDeleteOpen(false)
        // handleClose()
        return;
      }
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await handleContextAdd(values.description ?? '');
  }

  useEffect(() => {
    const GetCaseElement = async () => {
      const result = await getAssuranceCaseNode(
        node.type,
        node.data.id,
        session?.key ?? ''
      );
      return result;
    };

    GetCaseElement().then((result) => {
      if (!result.context) {
        return;
      }

      setContexts(result.context);
    });
  }, [node.data.id, node.type, session?.key]);

  // useEffect(() => {
  //   form.watch((values, { name }) => {
  //     if (name === 'description') {
  //       setUnresolvedChanges(true);
  //     }
  //   });
  // }, [form.watch, setUnresolvedChanges]);

  return (
    <div className="my-4 border-t">
      <div className="mt-4 font-medium text-muted-foreground text-sm">
        Please add a new context using thr form below.
      </div>

      <Form {...form}>
        <form className="my-4 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Type your description here."
                    rows={10}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex items-center justify-start gap-3 pt-4">
            <Button onClick={handleCancel} variant={'outline'}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
              disabled={loading}
              type="submit"
            >
              Add Context
            </Button>
          </div>
        </form>
      </Form>

      <div className="mt-8 font-medium">Existing Contexts</div>
      <p className="mb-4 text-muted-foreground text-sm">
        Please manage your contexts below
      </p>

      {loading ? (
        <div className="flex w-full flex-col justify-start gap-2 py-8">
          <Skeleton className="h-[10px] w-full rounded-full" />
          <Skeleton className="h-[10px] w-2/3 rounded-full" />
          <div className="flex items-center justify-start gap-2">
            <Skeleton className="h-[10px] w-[20px] rounded-full" />
            <Skeleton className="h-[10px] w-[100px] rounded-full" />
          </div>
        </div>
      ) : (
        <div className="mb-16 flex w-full flex-col items-start justify-start gap-3">
          {contexts.map((item: any, index: number) => (
            <div
              className="group relative w-full rounded-md p-3 text-foreground transition-all duration-300 hover:cursor-pointer hover:bg-indigo-500 hover:pb-6 hover:text-white"
              key={index}
            >
              <p className="w-full whitespace-normal">
                {item.long_description}
              </p>
              <div className="mt-3 flex items-center justify-start gap-2 text-muted-foreground text-xs transition-all duration-300 group-hover:text-white">
                <div className="flex-1">
                  {moment(item.created_date).format('DD/MM/YYY')}
                  <svg
                    aria-hidden="true"
                    className="mx-2 inline h-0.5 w-0.5 fill-current"
                    viewBox="0 0 2 2"
                  >
                    <circle cx={1} cy={1} r={1} />
                  </svg>
                  {item.name}
                </div>
                <Button
                  className="hidden group-hover:flex"
                  onClick={() => handleContextDelete(item.id)}
                  variant={'link'}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {contexts.length === 0 && (
            <div>
              <p className="flex items-center justify-start gap-2 text-muted-foreground text-sm">
                <FolderXIcon className="size-3" />
                No Contexts Added
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NodeConext;
