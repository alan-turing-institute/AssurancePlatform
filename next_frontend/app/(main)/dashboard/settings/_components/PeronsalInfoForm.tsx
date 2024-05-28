"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { MoveLeft } from "lucide-react"
import { useRouter } from "next/navigation"

const ACCEPTED_FILE_TYPES = ["jpg"];

const FormSchema = z.object({
  firstname: z.string().min(2, {
    message: "Firstname must be at least 2 characters.",
  }),
  lastname: z.string().min(2, {
    message: "Lastname must be at least 2 characters.",
  }),
  email: z.string().min(2, {
    message: "Email must be at least 2 characters.",
  }),
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  avatar: z.any()
    .refine(files => {
      if (!files) {
        return "Please select a file.";
      }
      if (!(files instanceof FileList)) {
        return "Expected a file.";
      }
      const filesArray = Array.from(files);
      if (!filesArray.every(file => ACCEPTED_FILE_TYPES.includes(file.type))) {
        return "Only JPG files are allowed.";
      }
      return true; // Validation passed
    })
})

export function PersonalInfoForm() {
  const router = useRouter()

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      firstname: 'Richard',
      lastname: 'Griffiths',
      email: 'rich.griffiths@gmail.com',
      username: 'Rich'
    },
  })

  function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(data)
  }

  return (
    <>
    <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 className="text-base font-semibold leading-7 text-foreground">Personal Information</h2>
        <p className="mt-1 text-sm leading-6 text-gray-400">
          Use a permanent address where you can receive mail.
        </p>
      </div>

      <div className="md:col-span-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
            <FormField
              control={form.control}
              name="avatar"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem className="col-span-full">
                  {/* <FormLabel>Change Avatar</FormLabel> */}
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
            />
            <FormField
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
              name="username"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="example@gmail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Save</Button>
        </form>
      </Form>
      </div>
    </div>
    </>
  )
}
