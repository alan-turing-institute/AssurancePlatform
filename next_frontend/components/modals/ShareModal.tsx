"use client";

import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShareModal } from "@/hooks/useShareModal";
import { Separator } from "../ui/separator";
import { Download, FileIcon, Share2, User2, X } from "lucide-react";
import { Button } from "../ui/button";
import AutoComplete, { User } from "../ui/autocomplete";
import { neatJSON } from "neatjson";
import { saveAs } from "file-saver";
import useStore from "@/data/store";

export const ShareModal = () => {
  const { assuranceCase, setAssuranceCase } = useStore()
  const shareModal = useShareModal();

  const [loading, setLoading] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])

  const router = useRouter()

  const users = [
    { name: 'Rich', email: 'rich.griffiths@gmail.com' },
    { name: 'Marlon', email: 'mdedakis@gmail.com' },
    { name: 'Carlos', email: 'carlos@gmail.com' },
    { name: 'Chris', email: 'chrisburr@gmail.com' },
    { name: 'Kalle', email: 'kalle@gmail.com' },
  ];
  
  const handleRemove = (email: string) => {
    const removedItem = selectedUsers.filter(item => item.email !== email)
    setSelectedUsers(removedItem)
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

  return (
    <Modal
      title="Share / Export Case"
      description="How would you like the share your assurance case?"
      isOpen={shareModal.isOpen}
      onClose={shareModal.onClose}
    >
      <div className="my-4 space-y-2">
        <h2 className="flex justify-start items-center gap-2"><User2 className="w-4 h-4"/> Share with users</h2>
        <AutoComplete
          options={users}
          selectedUsers={selectedUsers}
          setSelectedUsers={setSelectedUsers}
        />
        {selectedUsers.length > 0 ? (
          <div className="py-4 max-h-[250px] overflow-y-auto">
            {selectedUsers && selectedUsers.map((user: any) => (
              <div className="flex justify-start items-center gap-4 p-1 px-3 rounded-md hover:bg-indigo-600 hover:cursor-pointer group hover:text-white">
                <User2 className="w-4 h-4" />
                <div className="flex-1">
                  <p>{user.name}<span className="mx-2 text-muted-foreground group-hover:text-white">({user.email})</span></p>
                </div>
                <Button onClick={() => handleRemove(user.email)} size={"icon"} variant={"ghost"} className="hover:bg-indigo-700/50 hover:text-white"><X className="w-4 h-4"/></Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="pb-3 text-sm text-muted-foreground">No users selected</p>
        )}
        
        <Button className="my-2"><Share2 className="w-4 h-4 mr-2"/>Share</Button>
      </div>
      <Separator />
      <div className="my-4">
        <h2 className="flex justify-start items-center gap-2 mb-2"><FileIcon className="w-4 h-4"/>Export as JSON</h2>
        <p className="text-muted-foreground text-sm">Select the button below to download a JSON file.</p>
        <Button className="my-2" onClick={handleExport}><Download className="w-4 h-4 mr-2"/>Download File</Button>
      </div>
    </Modal>
  );
};
