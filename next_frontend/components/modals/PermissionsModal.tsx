"use client";

import { Modal } from "@/components/ui/modal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShareModal } from "@/hooks/useShareModal";
import { Separator } from "../ui/separator";
import { Download, FileIcon, Share2, Trash2, User2, UserCheck, UserX, X } from "lucide-react";
import { Button } from "../ui/button";
import { neatJSON } from "neatjson";
import { saveAs } from "file-saver";
import useStore from "@/data/store";
import { unauthorized, useLoginToken } from "@/hooks/useAuth";
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
import { usePermissionsModal } from "@/hooks/usePermissionsModal";

export const PermissionsModal = () => {
  const { assuranceCase } = useStore()
  const permissionModal = usePermissionsModal();

  const [loading, setLoading] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [viewMembers, setViewMembers] = useState<any[]>([])
  const [editMembers, setEditMembers] = useState<any[]>([])
  
  const [token] = useLoginToken();
  const router = useRouter()
  const { toast } = useToast();

  const fetchCaseMembers = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/sharedwith`, requestOptions);

    if(response.status === 401) return unauthorized()

    const result = await response.json()
    return result
  }

  useEffect(() => {
    if(assuranceCase) {
      fetchCaseMembers().then(result => {
        setViewMembers(result.view)
        setEditMembers(result.edit)
      })
    }
  },[assuranceCase])

  return (
    <Modal
      title="Permissions"
      description="Manage who has access to the current assurance case."
      isOpen={permissionModal.isOpen}
      onClose={permissionModal.onClose}
    >
      <p className="uppercase text-xs mb-2">Edit members</p>
      <Separator />
      
      <div className="my-4">
        {editMembers.length > 0 ? (
          editMembers.map((member: any) => (
            <div className="flex justify-start items-center gap-4 p-1 px-3 rounded-md  hover:cursor-pointer group">
              <User2 className="w-4 h-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button size={"icon"} variant={"ghost"} className="hover:bg-rose-500 dark:hover:bg-rose-700/50 hover:text-white"><Trash2 className="w-4 h-4"/></Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>

      <p className="uppercase text-xs mb-2">View members</p>
      <Separator />

      <div className="my-4">
        {viewMembers.length > 0 ? (
          viewMembers.map((member: any) => (
            <div className="flex justify-start items-center gap-4 p-1 px-3 rounded-md  hover:cursor-pointer group">
              <User2 className="w-4 h-4" />
              <div className="flex-1">
                <p>{member.email}</p>
              </div>
              <Button size={"icon"} variant={"ghost"} className="hover:bg-rose-500 dark:hover:bg-rose-700/50 hover:text-white"><Trash2 className="w-4 h-4"/></Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>
      
    </Modal>
  );
};
