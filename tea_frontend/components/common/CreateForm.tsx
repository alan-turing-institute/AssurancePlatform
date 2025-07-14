'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Goal } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { boolean, z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import useStore from '@/data/store';
import {
  addHiddenProp,
  createAssuranceCaseNode,
  setNodeIdentifier,
} from '@/lib/case-helper';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

// import { useLoginToken } from '@/hooks/useAuth'

const formSchema = z.object({
  // name: z.string().min(2, {
  //   message: "Name must be at least 2 characters.",
  // }),
  description: z.string().min(2, {
    message: 'Description must be atleast 2 characters',
  }),
});

interface CreateFormProps {
  onClose: () => void;
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

const CreateForm: React.FC<CreateFormProps> = ({
  onClose,
  setUnresolvedChanges,
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const [loading, setLoading] = useState<boolean>(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // name: '',
      description: '',
    },
  });

  useEffect(() => {
    form.watch((values, { name }) => {
      if (name === 'description' || name === 'URL') {
        setUnresolvedChanges(true);
      }
    });
  }, [form, setUnresolvedChanges]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const identifier = await setNodeIdentifier(null, 'goal');

    const newGoal = {
      name: 'G1',
      short_description: values.description,
      long_description: 'N/A',
      keywords: 'N/A',
      assurance_case_id: assuranceCase.id,
      context: [],
      property_claims: [],
      strategies: [],
      type: 'TopLevelNormativeGoal',
    };

    const result: any = await createAssuranceCaseNode(
      'goals',
      newGoal,
      session?.key ?? ''
    );

    if (result.error) {
      // TODO: Rendering error
      return console.log(result.error);
    }

    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [result.data],
    };

    const formattedAssuranceCase = await addHiddenProp(updatedAssuranceCase);
    setAssuranceCase(formattedAssuranceCase);
    onClose();
    setLoading(false);
    // window.location.reload()
  }

  return (
    <Form {...form}>
      <form className="mt-6 space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
        {/* <FormField
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
        <div className="flex items-center justify-start gap-3">
          <Button
            className="bg-indigo-500 text-white hover:bg-indigo-600"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Creating...' : 'Create Goal'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreateForm;
