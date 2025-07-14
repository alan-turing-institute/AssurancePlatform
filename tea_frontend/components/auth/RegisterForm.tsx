'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { Input } from '../ui/input';

const formSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(250)
    .regex(/^\S*$/, 'Username cannot contain spaces'),
  email: z.string().min(2).email(),
  password1: z
    .string()
    .min(8)
    .regex(
      /(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/,
      'Password must contain at least one uppercase letter, one number, and one special character'
    ),
  password2: z
    .string()
    .min(8)
    .regex(
      /(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/,
      'Password must contain at least one uppercase letter, one number, and one special character'
    ),
});

const RegisterForm = () => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>([]);
  const { data: session } = useSession();

  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password1: '',
      password2: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.password1 !== values.password2) {
      setErrors(['Your passwords must match, please try again.']);
      return;
    }

    setErrors([]);
    setLoading(true);

    try {
      const user = {
        username: values.username,
        email: values.email,
        password1: values.password1,
        password2: values.password2,
      };

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/auth/register/`,
        requestOptions
      );

      console.log(response);

      if (!response.ok) {
        setLoading(false);
        if (response.status === 400) {
          // Handle validation errors
          try {
            const result = await response.json();
            const currentErrors = [];

            if (result.username) {
              currentErrors.push(...result.username);
            }
            if (result.email) {
              currentErrors.push(...result.email);
            }
            if (result.password1) {
              currentErrors.push(...result.password1);
            }
            if (result.password2) {
              currentErrors.push(...result.password2);
            }
            if (result.non_field_errors) {
              currentErrors.push(...result.non_field_errors);
            }

            setErrors(
              currentErrors.length > 0
                ? currentErrors
                : ['Registration failed. Please try again.']
            );
          } catch (jsonError) {
            setErrors(['Registration failed. Please try again.']);
          }
        } else {
          setErrors(['Registration failed. Please try again.']);
        }
        return;
      }

      // Registration successful (HTTP 204 or 201)
      if (response.status === 204) {
        // Django returns 204 No Content for successful registration
        // Now sign in with NextAuth
        const signInResult = await signIn('credentials', {
          redirect: false,
          username: values.username,
          password: values.password1,
        });

        if (signInResult && signInResult.ok) {
          // NextAuth will handle redirect via authOptions callback
          router.push('/dashboard');
        } else {
          setLoading(false);
          setErrors([
            'Registration successful but login failed. Please try logging in manually.',
          ]);
        }
      } else {
        // Handle other success responses that might contain JSON
        try {
          const result = await response.json();

          if (result.key) {
            // Registration successful with key, now sign in with NextAuth
            const signInResult = await signIn('credentials', {
              redirect: false,
              username: values.username,
              password: values.password1,
            });

            if (signInResult && signInResult.ok) {
              // NextAuth will handle redirect via authOptions callback
              router.push('/dashboard');
            } else {
              setLoading(false);
              setErrors([
                'Registration successful but login failed. Please try logging in manually.',
              ]);
            }
          } else {
            setLoading(false);
            setErrors([
              'Registration completed but unexpected response format.',
            ]);
          }
        } catch (jsonError) {
          setLoading(false);
          setErrors([
            'Registration may have succeeded. Please try logging in.',
          ]);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    const token = session?.key;
    if (token) {
      router.push('/dashboard');
    }
  }, [session?.key, router]);

  return (
    <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12 dark:bg-slate-900">
        {errors &&
          errors.map((error: any) => (
            <div
              className="mb-6 rounded-md border border-rose-700 bg-rose-500/20 px-4 py-2 text-rose-700"
              key={crypto.randomUUID()}
            >
              <p>{error}</p>
            </div>
          ))}

        <Form {...form}>
          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Alan Turing" {...field} />
                  </FormControl>
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="inline-flex w-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Creating Account...' : 'Submit'}
            </Button>
          </form>
        </Form>
      </div>

      <p className="mt-10 text-center text-foreground text-sm">
        Already a member?{' '}
        <a
          className="font-semibold text-indigo-600 leading-6 hover:text-indigo-500"
          href={'/login'}
        >
          Login here
        </a>
      </p>
    </div>
  );
};

export default RegisterForm;
