"use client";

import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { useCreateCaseModal } from "@/hooks/useCreateCaseModal";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "../ui/button";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useLoginToken } from "@/hooks/useAuth";

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  // template: z.string().min(1)
});

export const CaseCreateModal = () => {
  const createCaseModal = useCreateCaseModal();
  const router = useRouter();
  const [token] = useLoginToken();

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  // const [templates, setTemplates] = useState<any[]>([]);
  // const [defaultValue, setDefaultValue] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      // template: ""
    },
  });

  const CreateCase = useCallback(
    (json_str: string) => {
      const requestOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: json_str,
      };

      setLoading(true);

      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/`, requestOptions)
        .then((response) => response.json())
        .then((json) => {
          if (json.id) {
            // navigate("/case/" + json.id);
            setLoading(false);
            createCaseModal.onClose()
            router.push(`/case/${json.id}`)
          } else {
            console.error(json);
            setLoading(false);
            setErrors(["An error occurred, please try again later"]);
          }
        })
        .catch((ex) => {
          console.error(ex);
          setLoading(false);
          setErrors(["An error occurred, please try again later"]);
        });
    },
    [token]
  );

  const handleCancel = (e: any) => {
    e.preventDefault()
    form.clearErrors()
    createCaseModal.onClose()
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // const newCase = templates[parseInt(values.template)]
      // newCase.name = values.name
      // newCase.description = values.description
      const newCase = {
        "name": values.name,
        "description": values.description,
        "lock_uuid": null,
        "goals": [],
        "color_profile": "default"
      }
      CreateCase(JSON.stringify(newCase))
    } catch (error) {
      console.log(error)
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
      title="Create New Assurance Case"
      description="Please enter a name and description for your new assurance case."
      isOpen={createCaseModal.isOpen}
      onClose={createCaseModal.onClose}
    >
    {loading ? (
      <div className="flex justify-center items-center p-16">
        <Loader className="w-10 h-10 animate-spin" />
      </div>
    ) : (
      <div className="space-y-4 py-2 pb-4">
        <div className="space-y-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input disabled={loading} placeholder="Case name" {...field} />
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
                      <Textarea disabled={loading} placeholder="Your case description" rows={6} {...field} />
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
              <div className="pt-6 space-x-2 flex items-center justify-end w-full">
                <Button disabled={loading} variant="outline" onClick={(e) => handleCancel(e)}>
                  Cancel
                </Button>
                <Button disabled={loading} type="submit">Submit</Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    )}

    </Modal>
  );
};
