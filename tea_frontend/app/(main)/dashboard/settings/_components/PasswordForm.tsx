'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

const ACCEPTED_FILE_TYPES = ['jpg'];

const FormSchema = z
  .object({
    currentPassword: z.string().min(2, {
      message: 'Current password must be at least 2 characters.',
    }),
    newPassword: z
      .string()
      .min(8, {
        message: 'New password must be at least 8 characters long.',
      })
      .regex(/[A-Z]/, {
        message: 'New password must contain at least one uppercase letter.',
      })
      .regex(/\d/, {
        message: 'New password must contain at least one number.',
      })
      .regex(/[!@#$%^&*(),.?":{}|<>]/, {
        message: 'New password must contain at least one special character.',
      }),
    confirmPassword: z.string().min(2, {
      message: 'Confirm password must be at least 2 characters.',
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'], // Field to which the error is attached
    message: 'Passwords do not match.',
  });

type PasswordFormProps = {
  data: any;
};

export function PasswordForm({ data }: PasswordFormProps) {
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const { data: session } = useSession();

  const notify = (message: string) => {
    toast({
      description: message,
    });
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    setError('');
    setLoading(true);

    const newDetails = {
      password: values.currentPassword,
      new_password: values.newPassword,
    };

    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/users/${data.id}/change-password`;

      const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newDetails),
      };

      const response = await fetch(url, requestOptions);

      if (response.status === 400) {
        const { error } = await response.json();
        if (error) {
          setError(error);
          return;
        }
      }
      notify('Password Updated Successfully!');
      form.reset();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 className="text-base font-semibold leading-7 text-foreground">
            Change password
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            Update your password associated with your account.
          </p>
        </div>

        <div className="md:col-span-2">
          {session?.provider === 'credentials' ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full space-y-6"
              >
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        {error && (
                          <p className="mb-2 text-rose-500">{`${error}, Please try again.`}</p>
                        )}
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormDescription>
                          Please enter your existing password.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Update
                </Button>
              </form>
            </Form>
          ) : (
            <p className="text-muted-foreground text-sm w-1/2">
              You are logged in with a{' '}
              <span className="text-indigo-500">{session?.provider}</span>{' '}
              account, therefore you cannot change your password here.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
