'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { useEffect, useState } from "react"
import { useEnforceLogout, useLoginToken } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  username: z.string()
    .min(2)
    .max(250)
    .regex(/^\S*$/, "Username cannot contain spaces"),
  email: z.string()
    .min(2)
    .email(),
  password1: z.string()
    .min(8)
    .regex(/(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_])/, "Password must contain at least one uppercase letter, one number, and one special character"),
  password2: z.string()
    .min(8)
    .regex(/(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_])/, "Password must contain at least one uppercase letter, one number, and one special character")
});

const RegisterForm = () => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>([]);
  const [_, setToken] = useLoginToken();

  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: ""
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if(values.password1 !== values.password2) {
      setErrors(['Your passwords must match, please try again.'])
      return
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      }
  
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/auth/register/`, requestOptions)

      console.log(response)

      if(!response.ok || response.status === 400) {
        setErrors(['Invalid details, please try again.'])
      }
  
      const result = await response.json()
  
      if (result.key) {
        setToken(result.key);
        router.push('/dashboard')
      }
      else {
          // const currentErrors = [];
          setLoading(false);
          setToken(null);
          // if (result.username) {
          //   currentErrors.push(...result.username.slice(1));
          // }
          // if (result.password1) {
          //   currentErrors.push(...result.password1.slice(1));
          // }
          // if (result.password2) {
          //   currentErrors.push(...result.password2.slice(1));
          // }
          // if (result.non_field_errors) {
          //   currentErrors.push(...result.non_field_errors);
          // }
          // setErrors(currentErrors);
      }
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    let token = localStorage.getItem("token");
    if(token) {
      router.push('/dashboard')
    }
  },[])

  return (
    <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <div className="bg-white dark:bg-slate-900 px-6 py-12 shadow sm:rounded-lg sm:px-12">

        {errors && errors.map((error: any) => (
          <div
          key={crypto.randomUUID()}
          className='bg-rose-500/20 rounded-md text-rose-700 border border-rose-700 py-2 px-4 mb-6'
          >
            <p>{error}</p>
          </div>
        ))}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    <Input type='email' placeholder="example@gmail.com" {...field} />
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
                    <Input type='password' {...field} />
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
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="infline-flex bg-indigo-600 hover:bg-indigo-500 w-full text-white">Submit</Button>
          </form>
        </Form>
      </div>

      <p className="mt-10 text-center text-sm text-foreground">
        Already a member?{' '}
        <a href={`/login`} className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
          Login here
        </a>
      </p>
    </div>
  )
}

export default RegisterForm
