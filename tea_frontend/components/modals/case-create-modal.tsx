'use client';

import { useCreateCaseModal } from '.*/use-create-case-modal';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '../ui/button';

// import { useLoginToken } from ".*/use-auth";

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  // template: z.string().min(1)
});

export const CaseCreateModal = () => {
  const createCaseModal = useCreateCaseModal();
  const router = useRouter();
  // const [token] = useLoginToken();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(false);
  const [_stage, _setStage] = useState(0);
  // const [templates, setTemplates] = useState<any[]>([]);
  // const [defaultValue, setDefaultValue] = useState(0);
  const [_errors, setErrors] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      // template: ""
    },
  });

  const CreateCase = useCallback(
    (json_str: string) => {
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${session?.key}`,
        },
        body: json_str,
      };

      setLoading(true);

      fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/`,
        requestOptions
      )
        .then((response) => response.json())
        .then((json) => {
          if (json.id) {
            // navigate("/case/" + json.id);
            setLoading(false);
            createCaseModal.onClose();
            router.push(`/case/${json.id}`);
          } else {
            setLoading(false);
            setErrors(['An error occurred, please try again later']);
          }
        })
        .catch((_ex) => {
          setLoading(false);
          setErrors(['An error occurred, please try again later']);
        });
    },
    [session, createCaseModal, router]
  );

  const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    form.clearErrors();
    createCaseModal.onClose();
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    try {
      // const newCase = templates[parseInt(values.template)]
      // newCase.name = values.name
      // newCase.description = values.description
      const newCase = {
        name: values.name,
        description: values.description,
        lock_uuid: null,
        goals: [],
        color_profile: 'default',
      };
      CreateCase(JSON.stringify(newCase));
    } catch (_error) {
      // Error handling for JSON.stringify or CreateCase call
    }
  };

  // const fetchTemplates = async () => {
  //   const response = await fetch('/api/templates')
  //   const result = await response.json()
  //   return result
  // }

  // useEffect(() => {
  //   fetchTemplates().then(result => {
  //     setTemplates(result.newTemplates);
  //     setDefaultValue(result.defaultCase);
  //   })
  // },[])

  return (
    <Modal
      description="Please enter a name and description for your new assurance case."
      isOpen={createCaseModal.isOpen}
      onClose={createCaseModal.onClose}
      title="Create New Assurance Case"
    >
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 py-2 pb-4">
          <div className="space-y-2">
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="Case name"
                          {...field}
                        />
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
                        <Textarea
                          disabled={loading}
                          placeholder="Your case description"
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Select a template...</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        {templates.map((template, index) => (
                          <FormItem key={crypto.randomUUID()} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={index.toString()} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {template.name}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
                <div className="flex w-full items-center justify-end space-x-2 pt-6">
                  <Button
                    disabled={loading}
                    onClick={(e) => handleCancel(e)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button disabled={loading} type="submit">
                    Submit
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      )}
    </Modal>
  );
};
