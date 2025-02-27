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
import { useEffect, useState } from "react"
import { createCaseStudy, deleteCaseStudy, updateCaseStudy } from "@/actions/caseStudies"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic";

import "react-quill/dist/quill.snow.css";
import { ArrowUpTrayIcon } from "@heroicons/react/20/solid"
import { useImportModal } from "@/hooks/useImportModal"
import RelatedAssuranceCaseList from "./RelatedAssuranceCaseList"

// Dynamically import ReactQuill (Next.js SSR fix)
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });// Import styles

const assuranceCaseSchema = z.object({
  id: z.number(),
  // naxme: z.string(),
});

const caseStudyFormSchema = z.object({
  id: z.number().optional(), // Optional ID for new case studies
  title: z.string().min(1, "Title is required"), // Required
  description: z.string().optional(),
  authors: z.string().optional(),
  category: z.string().optional(),
  publishedDate: z.coerce.date().optional(),
  lastModifiedOn: z.coerce.date().optional(),
  createdOn: z.coerce.date().optional(),
  sector: z.string().optional(),
  contact: z.string().email().optional(),
  assuranceCases: z.array(assuranceCaseSchema).optional(),
  image: z.any().optional(),
  published: z.boolean().optional(),
});

interface CaseStudyFormProps {
  caseStudy?: any
}

const CaseStudyForm = ({ caseStudy }: CaseStudyFormProps) => {
  const { data } = useSession()
  const { toast } = useToast();
  const router = useRouter()
  const importModal = useImportModal();

  const [value, setValue] = useState("");
  // State for selected assurance cases
  const [selectedAssuranceCases, setSelectedAssuranceCases] = useState<any[]>([]);

  useEffect(() => {
    if(caseStudy && caseStudy.assurance_cases.length > 0) {
      setSelectedAssuranceCases(caseStudy.assurance_cases)
    } else {
      setSelectedAssuranceCases([])
    }
  },[])

  // 1. Define your form.
  const form = useForm<z.infer<typeof caseStudyFormSchema>>({
    resolver: zodResolver(caseStudyFormSchema),
    defaultValues: caseStudy || {
      title: "",
      description: "",
      authors: "",
      category: "",
      publishedDate: undefined,
      lastModifiedOn: undefined,
      createdOn: undefined,
      sector: "",
      contact: "",
      assuranceCases: [],
      image: undefined,
      published: false,
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
  // async function onSubmit(values: z.infer<typeof caseStudyFormSchema>) {
  //   if (!caseStudy) {
  //     let newCaseStudy = {
  //       title: values.title,
  //       description: values.description,
  //       authors: values.authors,  
  //       category: values.category,
  //       // published_date: values.publishedDate?.toISOString(),
  //       last_modified_on: new Date().toISOString(),
  //       created_on: new Date().toISOString(),
  //       sector: values.sector,
  //       contact: values.contact,
  //       // assurance_cases": [2, 5],  
  //       // "image": "https://example.com/path-to-image.jpg",
  //     }

  //     const createdCaseStudy = await createCaseStudy(data?.key!!, newCaseStudy)

  //     if(createdCaseStudy) {
  //       toast({
  //         title: 'Successfully created',
  //         description: 'You have created a case study!',
  //       });
  //       router.back()
  //     }

  //   } else {
  //     let newCaseStudy = {
  //       id: caseStudy.id,
  //       title: values.title,
  //       description: values.description,
  //       authors: values.authors,  
  //       category: values.category,
  //       // published_date: values.publishedDate?.toISOString(),
  //       last_modified_on: new Date().toISOString(),
  //       sector: values.sector,
  //       contact: values.contact,
  //       // assurance_cases": [2, 5],  
  //       // "image": "https://example.com/path-to-image.jpg",
  //     }

  //     console.log(newCaseStudy)

  //     const updated = await updateCaseStudy(data?.key, newCaseStudy)

  //     if(updated) {
  //       toast({
  //         title: 'Successfully Updated',
  //         description: 'You have updated a case study!',
  //       });
  //     } else {
  //       toast({
  //         variant: "destructive",
  //         title: 'Failed to Update',
  //         description: 'Something went wrong!',
  //       });
  //     }
  //   }
  // }

  async function onSubmit(values: z.infer<typeof caseStudyFormSchema>) {
    const formData = new FormData();
    
    formData.append('title', values.title);
    formData.append('description', values.description || '');
    formData.append('authors', values.authors || '');
    formData.append('category', values.category || '');
    formData.append('last_modified_on', new Date().toISOString());
    formData.append('created_on', new Date().toISOString());
    formData.append('sector', values.sector || '');
    formData.append('contact', values.contact || '');
    
    // Append the assurance cases as a JSON string
    if(selectedAssuranceCases.length > 0) {
      formData.append('assurance_cases', JSON.stringify(selectedAssuranceCases));
    }

    // You can append more fields or files here (e.g., 'image', fileInput.files[0])
  
    if (!caseStudy) {
      const createdCaseStudy = await createCaseStudy(data?.key!!, formData);
  
      if (createdCaseStudy) {
        toast({
          title: 'Successfully created',
          description: 'You have created a case study!',
        });
        router.back();
      }
    } else {
      // For update, append the case study ID if needed
      formData.append('id', caseStudy.id.toString()); // Assuming caseStudy.id is a number
  
      const updated = await updateCaseStudy(data?.key, formData);
  
      if (updated) {
        toast({
          title: 'Successfully Updated',
          description: 'You have updated a case study!',
        });
      } else {
        toast({
          variant: "destructive",
          title: 'Failed to Update',
          description: 'Something went wrong!',
        });
      }
    }
  }

  const handleDelete = async () => {
    const deleted = await deleteCaseStudy(data?.key!!, caseStudy.id)

    if(deleted) {
      toast({
        title: 'Successfully Deleted',
        description: 'Case Study Deleted',
      });
      router.push('/dashboard/case-studies')
    } else {
      toast({
        variant: "destructive",
        title: 'Delete Failed',
        description: 'Something went wrong!',
      });
    }
  }

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [{ size: [] }],
      [{ font: [] }],
      [{ align: ["right", "center", "justify"] }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      [{ color: ["red", "#785412"] }],
      [{ background: ["red", "#785412"] }]
    ]
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    "bullet",
    "link",
    "color",
    "image",
    "background",
    "align",
    "size",
    "font"
  ];

  return (
    <div className="mt-6">
      <Separator className="my-6" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-2 gap-8">
          <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={caseStudy.published} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain/Sector</FormLabel>
                  <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={caseStudy.published}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}  disabled={caseStudy.published}>
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
                    <Input {...field}  disabled={caseStudy.published}/>
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
                    <Input {...field}  disabled={caseStudy.published} />
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
                  <ReactQuill
                    theme="snow"
                    value={field.value || value} // Ensure controlled component
                    onChange={(content) => {
                      field.onChange(content); // Update form state
                      setValue(content);
                    }}
                    modules={modules} 
                    formats={formats}
                    readOnly={caseStudy.published}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator className="my-6" />

          <div className="">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-4">Assurance cases</p>
              {/* <button
                onClick={() => importModal.onOpen()}
                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <ArrowUpTrayIcon className="-ml-0.5 md:mr-1.5 size-4" aria-hidden="true" />
                <span className='hidden md:block'>Import</span>
              </button> */}
            </div>
            <RelatedAssuranceCaseList 
              published={caseStudy.published} 
              selectedAssuranceCases={selectedAssuranceCases} 
              setSelectedAssuranceCases={setSelectedAssuranceCases} 
            />
          </div>

          <div className="">
            <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-4">Featured Image</p>

            {previewImage ? (
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

          <div className="flex justify-between items-center gap-4 w-full">
            <div>
              {!caseStudy.published && (
                <Button variant="default" type="submit">{caseStudy ? 'Update' : 'Create'}</Button>
              )}
            </div>
            {caseStudy && <Button variant="destructive" onClick={handleDelete} type="button">Delete</Button>}
          </div>

        </form>
      </Form>
    </div>
  )
}

export default CaseStudyForm
