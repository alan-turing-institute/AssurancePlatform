'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
// import { useLoginToken } from ".*/use-auth"
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/use-toast';
import type { User } from '@/types/domain';

const _ACCEPTED_FILE_TYPES = ['jpg'];

const FormSchema = z.object({
  // firstname: z.string().min(2, {
  //   message: "Firstname must be at least 2 characters.",
  // }),
  // lastname: z.string().min(2, {
  //   message: "Lastname must be at least 2 characters.",
  // }),
  username: z.string().min(2, {
    message: 'Username must be at least 2 characters.',
  }),
  email: z.string().min(2, {
    message: 'Email must be at least 2 characters.',
  }),
  // avatar: z.any()
  //   .refine(files => {
  //     if (!files) {
  //       return "Please select a file.";
  //     }
  //     if (!(files instanceof FileList)) {
  //       return "Expected a file.";
  //     }
  //     const filesArray = Array.from(files);
  //     if (!filesArray.every(file => ACCEPTED_FILE_TYPES.includes(file.type))) {
  //       return "Only JPG files are allowed.";
  //     }
  //     return true; // Validation passed
  //   })
});

type PersonalInfoFormProps = {
  data: User;
};

export function PersonalInfoForm({ data }: PersonalInfoFormProps) {
  const [loading, setLoading] = useState<boolean>(false);

  const _router = useRouter();
  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const { toast } = useToast();

  const notify = (message: string) => {
    toast({
      description: message,
    });
  };

  const notifyError = (message: string) => {
    toast({
      variant: 'destructive',
      title: 'Uh oh! Something went wrong.',
      description: message,
    });
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: data,
  });

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    setLoading(true);
    const userId = data.id;

    const newUserDetails = {
      username: values.username,
      email: values.email,
    };

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/users/${userId}/`;

      const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUserDetails),
      };

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        notifyError('Something went wrong');
        return;
      }

      const _result = await response.json();
      notify('User Updated Successfully!');
    } catch (_error) {
      // Silently handle error
    }

    setLoading(false);
  }

  return (
    <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 className="font-semibold text-base text-foreground leading-7">
          Personal Information
        </h2>
        <p className="mt-1 text-gray-400 text-sm leading-6">
          Use a permanent address where you can receive mail.
        </p>
      </div>

      <div className="md:col-span-2">
        <Form {...form}>
          <form
            className="w-full space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
              {/* <FormField
              control={form.control}
              name="avatar"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem className="col-span-full">
                  <FormControl>
                    <div className="flex justify-start items-center gap-6">
                      <img
                        src="https://images.unsplash.com/photo-1514866747592-c2d279258a78?q=80&w=3087&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                        alt=""
                        className="h-24 w-24 flex-none rounded-lg bg-gray-800 object-cover"
                      />
                      <div className="">
                        <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-3">Change Avatar</p>
                        <Input
                          {...fieldProps}
                          type="file"
                          onChange={(event) =>
                            onChange(event.target.files && event.target.files[0])
                          }
                        />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
              {/* <FormField
              control={form.control}
              name="firstname"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastname"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example@gmail.com"
                        {...field}
                        readOnly={!!session}
                      />
                    </FormControl>
                    {session && (
                      <FormDescription className="flex items-center justify-start text-xs">
                        <Lock className="mr-2 h-3 w-3" />
                        Read only
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example@gmail.com"
                        type="email"
                        {...field}
                        readOnly={data.email !== ''}
                      />
                    </FormControl>
                    {data.email === '' ? (
                      false
                    ) : (
                      <FormDescription className="flex items-center justify-start text-xs">
                        <Lock className="mr-2 h-3 w-3" />
                        Read only
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!data.email && (
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={loading}
                type="submit"
              >
                {loading ? 'Updating' : 'Update'}
              </Button>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
