'use client'

import { Camera, Expand, ExternalLink, Goal, Group, Info, ListTree, Network, Notebook, Plus, RotateCcw, RotateCw, SearchIcon, Share2, Trash2, Users2 } from "lucide-react";
import { Node } from "reactflow";
import { useEffect, useState } from "react";
import NodeCreate from "@/components/common/NodeCreate";
import useStore from "@/data/store";
import { useLoginToken } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { AlertModal } from "../modals/alertModal";
import { neatJSON } from "neatjson";
import { saveAs } from "file-saver";
import ActionTooltip from "../ui/action-tooltip";
import CaseNotes from "./CaseNotes";

import html2canvas from 'html2canvas'
import { capture, test } from "@/actions/capture";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useShareModal } from "@/hooks/useShareModal";
import { usePermissionsModal } from "@/hooks/usePermissionsModal";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import SearchNodes from "../common/SearchNodes";


interface ActionButtonProps {
  showCreateGoal: boolean
  actions: any
  notify: (message: string) => void
  notifyError: (message: string) => void
}

const ActionButtons = ({ showCreateGoal, actions, notify, notifyError }: ActionButtonProps) => {
  const [open, setOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false);

  const [token] = useLoginToken();
  const { assuranceCase, setAssuranceCase } = useStore()
  const router = useRouter()

  const { onLayout } = actions

  const shareModal = useShareModal();
  const permissionModal = usePermissionsModal();

  const onDelete = async () => {
    try {
      setLoading(true);
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${token}`,
        },
        method: "DELETE",
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`, requestOptions)
      if(response.ok) {
        router.push('/')
      }
    } catch (error: any) {
      console.log('ERROR!!!!', error)
    } finally {
      setLoading(false);
      setDeleteOpen(false);
    }
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

  const handleCapture = async () => {
    const screenshotTarget = document.getElementById('ReactFlow');
    if(screenshotTarget) {
      const canvas = await html2canvas(screenshotTarget)

      const base64image = canvas.toDataURL("image/png");

      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const newImage = JSON.stringify({
        id: assuranceCase.id,
        base64: base64image
      });

      const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: newImage,
        redirect: "follow"
      };

      const response = await fetch("/api/screenshot", requestOptions)
      const { imageUrl, error, message } = await response.json()

      if(error) {
        notifyError(message)
      }

      if(imageUrl) {
        notify('Screenshot Saved!')
      }
    }
  }

  const handleNameReset = async () => {
    try {
      setLoading(true);
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${token}`,
        },
        method: "POST",
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/update-ids`, requestOptions)
      if(response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.log('Something went wrong', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 flex justify-center items-center">
    <div className="w-1/8 m-auto bg-indigo-100 dark:bg-indigo-500/20 shadow-lg text-white py-2 px-4 flex justify-center items-center gap-2 rounded-full">
      <div className="pr-2 border-r-2 border-r-indigo-200 dark:border-r-indigo-800/60 flex justify-center items-center gap-2">
        {showCreateGoal && (assuranceCase.permissions !== 'view' || assuranceCase.permissions !== 'review') && (
         <ActionTooltip label='New Goal'>
            <button onClick={() => setOpen(true)} className="w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full p-3"><Plus className='w-5 h-5' /><span className="sr-only">Add Goal</span></button>
          </ActionTooltip>
        )}
        <ActionTooltip label='Focus'>
          <button id='FocusBtn' onClick={() => onLayout('TB')} className="w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full p-3"><Group className='w-5 h-5' /><span className="sr-only">Focus</span></button>
        </ActionTooltip>
        {(assuranceCase.permissions !== 'view' && assuranceCase.permissions !== 'review') && (
        <ActionTooltip label='Reset Identifiers'>
          <button onClick={() => setAlertOpen(true)} className="w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full p-3"><RotateCw className='w-5 h-5' /><span className="sr-only">Reset Identifiers</span></button>
        </ActionTooltip>
        )}
        <ActionTooltip label='Resources'>
          <button className="w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full p-3"><Info className='w-5 h-5' /><span className="sr-only">Resources</span></button>
        </ActionTooltip>
      </div>
      <div className="flex justify-center items-center gap-2">
        {/* <ActionTooltip label='Export'>
          <button onClick={handleExport} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><ExternalLink className='w-5 h-5' /><span className="sr-only">Export</span></button></ActionTooltip> */}
       {assuranceCase.permissions !== 'view' && (
          <ActionTooltip label='Share & Export'>
            <button onClick={() => shareModal.onOpen()} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><ExternalLink className='w-5 h-5' /><span className="sr-only">Share & Export</span></button>
          </ActionTooltip>
        )}
        {assuranceCase.permissions === 'manage' && (
          <ActionTooltip label='Permissions'>
            <button onClick={() => permissionModal.onOpen()} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><Users2 className='w-5 h-5' /><span className="sr-only">Permissions</span></button>
          </ActionTooltip>
        )}
        <ActionTooltip label='Notes'>
          <button onClick={() => setNotesOpen(true)} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><Notebook className='w-5 h-5' /><span className="sr-only">Notes</span></button>
        </ActionTooltip>
        {(assuranceCase.permissions === 'manage' || assuranceCase.permissions === 'editor') && (
          <ActionTooltip label='Capture'>
            <button onClick={handleCapture} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><Camera className='w-5 h-5' /><span className="sr-only">Capture</span></button>
          </ActionTooltip>
        )}
        {assuranceCase.permissions === 'manage' && (
          <ActionTooltip label='Delete'>
            <button onClick={() => setDeleteOpen(true)} className="p-3 w-50 h-50 bg-rose-500 hover:bg-rose-600 transition-all rounded-full"><Trash2 className='w-5 h-5' /><span className="sr-only">Delete</span></button>
          </ActionTooltip>
        )}
      </div>
      <NodeCreate isOpen={open} setOpen={setOpen} />
      <CaseNotes isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={loading}
        confirmButtonText={'Delete'}
      />
       <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={handleNameReset}
        loading={loading}
        message={'Updating the identifiers will systematically reset all of the unique labels that are displayed for each of the elements (e.g. P1, E1), so that they are continuous. This cannot be undone.'}
        confirmButtonText={'Yes, reset all identifiers'}
        cancelButtonText={'No, keep current identifiers'}
      />
    </div>
    </div>
  )
}

export default ActionButtons
