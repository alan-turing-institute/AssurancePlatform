"use client";

import { Modal } from "@/components/ui/modal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShareModal } from "@/hooks/useShareModal";
import { Separator } from "../ui/separator";
import { Download, FileIcon, Share2, User2, UserCheck, UserX, X } from "lucide-react";
import { Button } from "../ui/button";
import { neatJSON } from "neatjson";
import { saveAs } from "file-saver";
import useStore from "@/data/store";
// import { unauthorized, useLoginToken } from "@/hooks/useAuth";
import { User } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "../ui/use-toast";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useSession } from "next-auth/react";

type ShareItem = {
  email: string
  view?: boolean
  edit?: boolean
  review?: boolean
}

type ShareItemArray = ShareItem[]

const FormSchema = z.object({
  email: z.string().min(2, {
    message: "Email must be at least 2 characters.",
  }).email(),
  accessLevel: z.string().min(1)
})

export const ShareModal = () => {
  const { assuranceCase, viewMembers, setViewMembers, editMembers, setEditMembers, reviewMembers, setReviewMembers } = useStore()
  const shareModal = useShareModal();

  const [loading, setLoading] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])

  // const [token] = useLoginToken();
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      accessLevel: "Read"
    },
  })

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setLoading(true)
    const payload: ShareItemArray = []

    const newShareItem: ShareItem = { email: data.email }

    switch (data.accessLevel) {
      case 'Read':
        newShareItem.view = true
        break;
      case 'Edit':
        newShareItem.edit = true
        break;
      case 'Reviewer':
        newShareItem.review = true
        break;
    }

    // if(data.accessLevel === 'Edit') {
    //   newShareItem.edit = true
    // } else {
    //   newShareItem.view = true
    // }

    payload.push(newShareItem)

    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/sharedwith`;

      const requestOptions: RequestInit = {
        method: "POST",
        headers: {
          Authorization: `Token ${session?.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      };
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        console.log(`Something went wrong ${response.status}`)

        toast({
          variant: 'destructive',
          title: 'Unable to share case',
          description: 'The email is not registered to an active user of the TEA platform.',
        });

        setLoading(false)
        return
      }

      // const result = await response.json();
      // console.log("Shared Result", result);

      toast({
        variant: 'success',
        title: 'Shared Case with:',
        description: `${data.email}`,
      });

      if(newShareItem.view) {
        setViewMembers([...viewMembers, newShareItem ])
      }
      if(newShareItem.edit) {
        setEditMembers([...editMembers, newShareItem ])
      }
      if(newShareItem.review) {
        setReviewMembers([...reviewMembers, newShareItem ])
      }

      form.reset()
    } catch (error) {
      console.log("Error", error);

      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong',
      });
    }

    setLoading(false)
  }

  const handleExport = () => {
    setLoading(true);

    let json = neatJSON(assuranceCase, {});
    // Remove the `id` fields, since they are only meaningful to the backend, and might
    // confuse it when importing the JSON exported here.
    json = json.replaceAll(/"id":\d+(,)?/g, "");

    const name = assuranceCase["name"];

    // Write to a file, which to the user shows as a download.
    const blob = new Blob([json], {
      type: "text/plain;charset=utf-8",
    });

    const now = new Date();
    // Using a custom date format because the ones that Date offers are either very long
    // or include characters not allowed in filenames on Windows.
    const datestr =
      now.getFullYear() +
      "-" +
      now.getMonth() +
      "-" +
      now.getDate() +
      "T" +
      now.getHours() +
      "-" +
      now.getMinutes() +
      "-" +
      now.getSeconds();
    const filename = name + "-" + datestr + ".json";
    saveAs(blob, filename);
    setLoading(false);
  }

  // const fetchAllUsers = async () => {
  //   const requestOptions: RequestInit = {
  //     headers: {
  //       Authorization: `Token ${token}`,
  //     },
  //   };

  //   const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/`, requestOptions);

  //   if(response.status === 404 || response.status === 403 ) {
  //     // TODO: 404 NOT FOUND PAGE
  //     console.log('Render Not Found Page')
  //     return
  //   }

  //   if(response.status === 401) return unauthorized()

  //   const result = await response.json()
  //   return result
  // }

  // useEffect(() => {
  //   fetchAllUsers().then(result => console.log(result.filter((user: any) => user.email.includes('rich.griffiths'))))
  // },[])

  return (
    <Modal
      title="Share / Export Case"
      description="How would you like the share your assurance case?"
      isOpen={shareModal.isOpen}
      onClose={shareModal.onClose}
    >
      {error && (
        <div className="w-full bg-rose-500/20 border-2 border-rose-700 text-rose-600 py-1 px-3 rounded-md flex justify-start items-center gap-2">
          <UserX className="w-4 h-4"/>{error}
        </div>
      )}
      {successMessage && (
        <div className="w-full bg-emerald-500/20 border-2 border-emerald-700 text-emerald-600 py-1 px-3 rounded-md flex justify-start items-center gap-2">
          <UserCheck className="w-4 h-4"/>{successMessage}
        </div>
      )}
      {assuranceCase && assuranceCase.permissions === 'manage' && (
      <div className="my-4 space-y-2">
        <h2 className="flex justify-start items-center gap-2"><User2 className="w-4 h-4"/> Share with users</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="hidden">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="accessLevel"
                  render={({ field }) => (
                    <FormItem className="pb-2">
                      <FormLabel>Access Level</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex justify-start items-center space-x-2"
                        >
                          <FormItem key={crypto.randomUUID()} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={'Read'} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Read
                            </FormLabel>
                          </FormItem>
                          <FormItem key={crypto.randomUUID()} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={'Edit'} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Edit
                            </FormLabel>
                          </FormItem>
                          <FormItem key={crypto.randomUUID()} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={'Reviewer'} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Reviewer
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <Button type="submit" disabled={loading}><Share2 className="w-4 h-4 mr-2"/>Share</Button>
            </form>
          </Form>
      </div>
      )}
      <Separator />
      <div className="my-4">
        <h2 className="flex justify-start items-center gap-2 mb-2"><FileIcon className="w-4 h-4"/>Export as JSON</h2>
        <p className="text-muted-foreground text-sm">Select the button below to download a JSON file.</p>
        <Button className="my-2" onClick={handleExport}><Download className="w-4 h-4 mr-2"/>Download File</Button>
      </div>
    </Modal>
  );
};
