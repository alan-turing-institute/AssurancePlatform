"use client";

import { Modal } from "@/components/ui/modal";
import { useImportModal } from "@/hooks/useImportModal";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCallback, useState } from "react";
import { useLoginToken } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

const ACCEPTED_FILE_TYPES = ["application/json"]; // Correct MIME type for JSON files

const formSchema = z.object({
  file: z.any()
    .refine(files => {
      if (!files) {
        return "Please select a file.";
      }
      if (!(files instanceof FileList)) {
        return "Expected a file.";
      }
      const filesArray = Array.from(files);
      if (!filesArray.every(file => ACCEPTED_FILE_TYPES.includes(file.type))) {
        return "Only JSON files are allowed.";
      }
      return true; // Validation passed
    })
});


export const ImportModal = () => {
  const importModal = useImportModal();
  const [token] = useLoginToken();

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([]);

  const router = useRouter()

  const form = useForm({
    resolver: zodResolver(formSchema)
  })

  const ImportCreateCase = useCallback(
    (json: any) => {
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(json),
      };

      setLoading(true);

      fetch("http://localhost:8000/api/cases/", requestOptions)
        .then((response) => response.json())
        .then((json) => {
          if (json.id) {
            // navigate("/case/" + json.id);
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

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const { file } = values
    
    try {
      if (file) {
        const fileReader = new FileReader();
  
        fileReader.onload = async (event: any) => {
          try {
            const json = JSON.parse(event.target.result as string);
            await ImportCreateCase(json);
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
        };
  
        fileReader.readAsText(file);
      }
    } catch (error) {
      console.error("Error reading file:", error);
    }
  };

  return (
    <Modal
      title="Import File"
      description="Please select a file you wish to import to create your case."
      isOpen={importModal.isOpen} 
      onClose={importModal.onClose}
    >
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <FormField
          control={form.control}
          name="file"
          render={({ field: { value, onChange, ...fieldProps } }) => (
            <FormItem>
              {/* <FormLabel>File</FormLabel> */}
              <FormControl>
                <Input
                  {...fieldProps}
                  type="file"
                  onChange={(event) =>
                    onChange(event.target.files && event.target.files[0])
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
    </Modal>
  );
};