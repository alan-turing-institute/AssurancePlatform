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
import { CloudDownload, InfoIcon, Share, Share2Icon, Trash2Icon, X } from "lucide-react"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  type: z.string().optional(),
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
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [previewImage, setPreviewImage] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");

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
      type: "",
      contact: "",
      assuranceCases: [],
      image: undefined,
      published: false,
    },
  })

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

  async function uploadCaseStudyFeatureImage(caseStudyId: number, imageFile: File) {
    const formData = new FormData();
    formData.append('media', imageFile); // Ensure it matches request.FILES.get("media")

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/${caseStudyId}/image/`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Token ${data?.key!!}`, // Replace with actual auth token
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload feature image');
      }

      const result = await response.json();
      console.log('Feature image uploaded:', result);
      toast({
        title: 'Feature Image Uploaded',
        description: 'Feature image successfully uploaded!',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        variant: "destructive",
        title: 'Image Upload Failed',
        description: 'Could not upload feature image!',
      });
    }
  }

  async function deleteCaseStudyFeatureImage(caseStudyId: number) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/${caseStudyId}/image/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${data?.key!!}`, // Replace with actual auth token
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete feature image');
      }

      console.log('Feature image deleted');
      // toast({
      //   title: 'Feature Image Removed',
      //   description: 'Feature image successfully uploaded!',
      // });
    } catch (error) {
      console.error('Error deleting image:', error);
      // toast({
      //   variant: "destructive",
      //   title: 'Image Upload Failed',
      //   description: 'Could not upload feature image!',
      // });
    }
  }

  const fetchFeaturedImage = async () => {
    try {
      const requestOptions: RequestInit = {
        method: "GET",
        headers: {
          Authorization: `Token ${data?.key}`,
        },
        redirect: "follow"
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/${caseStudy.id}/image`, requestOptions)

      // if(response.status == 404) {
      //   setImgSrc('/images/assurance-case-medium.png')
      //   return
      // }

      const result = await response.json()
      setFeaturedImage(result.image)
    } catch (error) {
      console.log('Failed to fetch image')
    } finally {
      setImageLoading(false)
    }
  }

  useEffect(() => {
    if(caseStudy) {
      fetchFeaturedImage()
    }
  }, [caseStudy])


  async function onSubmit(values: z.infer<typeof caseStudyFormSchema>) {
    const formData = new FormData();

    formData.append('title', values.title);
    formData.append('description', values.description || '');
    formData.append('authors', values.authors || '');
    formData.append('category', values.category || '');
    formData.append('last_modified_on', new Date().toISOString());
    formData.append('created_on', new Date().toISOString());
    formData.append('sector', values.sector || '');
    formData.append('type', values.type || '');
    formData.append('contact', values.contact || '');

    // Append the assurance cases as a JSON string
    if(selectedAssuranceCases.length > 0) {
      formData.append('assurance_cases', JSON.stringify(selectedAssuranceCases));
    }

    // You can append more fields or files here (e.g., 'image', fileInput.files[0])

    if (!caseStudy) {
      const createdCaseStudy = await createCaseStudy(data?.key!!, formData);

      // Upload feature image if exists
      if (values.image) {
        const uploadedImage = await uploadCaseStudyFeatureImage(createdCaseStudy.id, values.image);
        console.log('uploadedImage', uploadedImage)
      }

      if (createdCaseStudy) {
        toast({
          title: 'Successfully created',
          description: 'You have created a case study!',
        });
        router.push(`/dashboard/case-studies/${createdCaseStudy.id}`);
      }
    } else {
      // For update, append the case study ID if needed
      formData.append('id', caseStudy.id.toString()); // Assuming caseStudy.id is a number

      const updated = await updateCaseStudy(data?.key, formData);

      // Upload feature image if exists
      if (values.image) {
        const uploadedImage = await uploadCaseStudyFeatureImage(caseStudy.id, values.image);
        console.log('uploadedImage', uploadedImage)
      }

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

  const handlePublish = async () => {
    const formData = new FormData();
    formData.append('id', caseStudy.id.toString());
    formData.append('assurance_cases', JSON.stringify(caseStudy.assurance_cases));

    // Set only the fields that need updating
    if (caseStudy.published) {
      formData.append("published", "false"); // Convert boolean to string
      formData.append("published_date", ""); // Clear the published date
    } else {
      formData.append("published", "true"); // Convert boolean to string
      formData.append("published_date", new Date().toISOString()); // Set new date
    }

    // Send the formData to the API
    const response = await updateCaseStudy(data?.key, formData);

    if (response) {
      toast({
        title: caseStudy.published ? "Successfully Unpublished" : "Successfully Published",
        description: `You have ${caseStudy.published ? "unpublished" : "published"} your case study!`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Failed to Update",
        description: "Something went wrong!",
      });
    }
  };

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
      <TooltipProvider>
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
                      <Input {...field} disabled={caseStudy && caseStudy.published} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={caseStudy && caseStudy.published}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}  disabled={caseStudy && caseStudy.published}>
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
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}  disabled={caseStudy && caseStudy.published}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Assurance Case", "Argument Pattern"].map((sector) => (
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
                    <FormLabel>Email for Corresponding Author</FormLabel>
                    <FormControl>
                      <Input {...field}  disabled={caseStudy && caseStudy.published}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="authors"
                render={({ field }) => {
                  const initialAuthors = field.value ? field.value.split(",").map(a => a.trim()) : [];
                  const [authors, setAuthors] = useState<string[]>(initialAuthors);
                  const [inputValue, setInputValue] = useState("");

                  const addAuthor = () => {
                    const trimmed = inputValue.trim();
                    if (trimmed && !authors.includes(trimmed)) {
                      const newAuthors = [...authors, trimmed];
                      setAuthors(newAuthors);
                      field.onChange(newAuthors.join(", "));
                      setInputValue(""); // Clear input
                    }
                  };

                  const removeAuthor = (authorToRemove: string) => {
                    const newAuthors = authors.filter(author => author !== authorToRemove);
                    setAuthors(newAuthors);
                    field.onChange(newAuthors.join(", "));
                  };

                  return (
                    <FormItem>
                      <FormLabel>Authors</FormLabel>

                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder="Enter author name"
                          disabled={caseStudy?.published}
                        />
                        <Button
                          type="button"
                          onClick={addAuthor}
                          disabled={!inputValue.trim() || caseStudy?.published}
                        >
                          Add Author
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {authors.map((author) => (
                          <span
                            key={author}
                            className="flex items-center px-2 py-1 text-sm bg-muted rounded-full"
                          >
                            {author}
                            {!caseStudy?.published && (
                              <button
                                type="button"
                                onClick={() => removeAuthor(author)}
                                className="ml-1 text-muted-foreground hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>

                      <FormMessage />
                    </FormItem>
                  );
                }}
              />



            </div>

            <Separator className="my-6" />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1 mb-2">
                    <FormLabel>Description</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <InfoIcon className="w-4 h-4 text-muted-foreground cursor-pointer" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Provide a clear and concise summary of the case study.
                      </TooltipContent>
                    </Tooltip>
                  </div>
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
                      readOnly={caseStudy && caseStudy.published}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <Separator className="my-6" />

            <div className="">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-4">Related Assurance Cases</p>
                {/* <button
                  onClick={() => importModal.onOpen()}
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <ArrowUpTrayIcon className="-ml-0.5 md:mr-1.5 size-4" aria-hidden="true" />
                  <span className='hidden md:block'>Import</span>
                </button> */}
              </div>
              <RelatedAssuranceCaseList
                published={caseStudy ? caseStudy.published : false}
                selectedAssuranceCases={selectedAssuranceCases}
                setSelectedAssuranceCases={setSelectedAssuranceCases}
              />
            </div>

            <div>
            <div className="flex items-center gap-1">
              <FormLabel htmlFor="image">Featured Image</FormLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <InfoIcon className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Upload a representative image for this case study.
                </TooltipContent>
              </Tooltip>
            </div>

              {caseStudy && caseStudy.published ? (
                <div className="w-full max-w-3xl mx-auto relative h-[500px] group">
                  <Image
                    src={previewImage || featuredImage}
                    alt="image"
                    fill
                    className="object-cover aspect-video rounded-lg"
                  />
                </div>
              ) : (
                previewImage || featuredImage ? (
                  <div className="w-10/12 relative h-[500px] group mt-6">
                    <Image
                      src={previewImage || featuredImage}
                      alt="image"
                      fill
                      className="object-cover aspect-video rounded-lg"
                    />
                    <div className="absolute bg-indigo-900/70 h-full w-full flex justify-center items-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {}
                      <Button
                        variant="destructive"
                        type="button"
                        onClick={() => {
                          setPreviewImage(""); // Clear the preview
                          setFeaturedImage(""); // Clear the preview
                          form.setValue("image", ""); // Reset the form field
                          if(featuredImage) {
                            deleteCaseStudyFeatureImage(caseStudy.id)
                          }
                        }}
                      >
                        <Trash2Icon className="size-4 mr-2" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Input type="file" accept="image/*" onChange={handleFileChange} disabled={caseStudy && caseStudy.published} />
                )
              )}
            </div>

            <div className="flex justify-between items-center gap-4 w-full">
              <div className="flex justify-start items-center gap-2">
                  {caseStudy && !caseStudy.published && <Button variant="default" type="submit">Save as draft</Button>}
                  {!caseStudy && (
                    <Button variant="default" type="submit">Save</Button>
                  )}
                  {caseStudy && (
                    <Button
                      variant="primary"
                      type="button"
                      onClick={handlePublish}
                    >
                      {caseStudy.published ? (
                        <>
                          <CloudDownload className="size-4 mr-2" />
                          <span>Unublish</span>
                        </>
                      ) : (
                        <>
                          <Share className="size-4 mr-2" />
                          <span>Publish</span>
                        </>
                      )}
                    </Button>
                  )}
              </div>
              {caseStudy && <Button variant="destructive" onClick={handleDelete} type="button"><Trash2Icon className="size-4 mr-2"/>Delete</Button>}
            </div>

          </form>
        </Form>
      </TooltipProvider>
    </div>
  )
}

export default CaseStudyForm
