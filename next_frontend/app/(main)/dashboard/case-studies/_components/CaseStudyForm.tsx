'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import Image from "next/image"
import { Trash2Icon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"

const assuranceCaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const formSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  authors: z.string(),
  category: z.string(),
  publishedDate: z.coerce.date(),
  lastModifiedOn: z.coerce.date(),
  createdOn: z.coerce.date(),
  sector: z.string(),
  contact: z.string().email(),
  assuranceCases: z.array(assuranceCaseSchema),
  image: z.any(),
  published: z.boolean(),
});

interface CaseStudyFormProps {
  caseStudy: any
}

const CaseStudyForm = ({ caseStudy }: CaseStudyFormProps) => {
  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: caseStudy || {
      sector: '',
      datePublished: '',
      category: '',
      contact: '',
      authors: '',
      description: '',
      featuredImage: '',
      assuranceCases: '',
    },
  })

  const [previewImage, setPreviewImage] = useState(caseStudy?.image || "");

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      setPreviewImage(URL.createObjectURL(file));
      form.setValue("image", file);
    }
  };
 
  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log('VALUES', values)
  }

  return (
    <div className="mt-6">

      <Separator className="my-6" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          <div className="grid grid-cols-2 gap-8">
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain/Sector</FormLabel>
                  <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Business", "Technology", "Healthcare", "Finance"].map((sector) => (
                        <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {["AI", "Business", "Health", "Education"].map((sector) => (
                          <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-2 gap-8">
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authors</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator className="my-6" />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator className="my-6" />

          <div className="">
            <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-4">Assurance cases</p>
          </div>

          <div className="">
            <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-4">Featured Image</p>

            {previewImage ? (
              // <img src={previewImage} alt="Preview" className="w-full h-40 object-cover rounded-lg mb-2" />
              <div className="w-10/12 relative h-[500px] group">
                <Image
                  src={previewImage}
                  alt="image"
                  fill
                  className="object-cover aspect-video rounded-lg"
                />
                <div className="absolute bg-indigo-900/70 h-full w-full flex justify-center items-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Button 
                  variant="destructive" 
                  type="button"
                  onClick={() => {
                    setPreviewImage(""); // Clear the preview
                    form.setValue("image", ""); // Reset the form field
                  }}
                >
                  <Trash2Icon className="size-4 mr-2" /> Remove
                </Button>
                </div>
              </div>
            ) : (
              <Input type="file" accept="image/*" onChange={handleFileChange} />
            )}
          </div>

          <div className="flex justify-start items-center gap-4">
            <Button variant={"secondary"}>Cancel</Button>
            <Button variant={"default"} type="submit">Update</Button>
          </div>
        </form>
      </Form>

    </div>
  )
}

export default CaseStudyForm
