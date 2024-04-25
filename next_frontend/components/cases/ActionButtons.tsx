'use client'

import { Expand, ExternalLink, Goal, Group, ListTree, Network, Notebook, Plus, RotateCcw, Share2, Trash2 } from "lucide-react";
import { Node } from "reactflow";
import { useState } from "react";
import NodeCreate from "@/components/common/NodeCreate";
import useStore from "@/data/store";
import { useLoginToken } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { AlertModal } from "../modals/alertModal";

interface ActionButtonProps {
  showCreateGoal: boolean
  actions: any
}

const ActionButtons = ({ showCreateGoal, actions }: ActionButtonProps) => {
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false);

  const [token] = useLoginToken(); 
  const { assuranceCase, setAssuranceCase } = useStore()
  const router = useRouter()

  const { onLayout } = actions

  const onDelete = async () => {
    try {
      setLoading(true);
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${token}`,
        },
        method: "DELETE",
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/`, requestOptions)
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

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 flex justify-center items-center">
    <div className="w-1/8 m-auto bg-indigo-100 dark:bg-indigo-500/20 shadow-lg text-white py-2 px-4 flex justify-center items-center gap-2 rounded-full">
      <div className="pr-2 border-r-2 border-r-indigo-200 dark:border-r-indigo-800/60 flex justify-center items-center gap-2">
        {showCreateGoal && (<button onClick={() => setOpen(true)} className="w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full p-3"><Plus className='w-5 h-5' /></button>)}
        <button id='FocusBtn' onClick={() => onLayout('TB')} className="w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full p-3"><Group className='w-5 h-5' /></button>
      </div>
      <div className="flex justify-center items-center gap-2">
        <button onClick={() => alert('reset names')} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><ExternalLink className='w-5 h-5' /></button>
        <button onClick={() => alert('reset names')} className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><Share2 className='w-5 h-5' /></button>
        <button className="p-3 w-50 h-50 bg-indigo-700 hover:bg-indigo-800 transition-all rounded-full"><Notebook className='w-5 h-5' /></button>
        <button onClick={() => setDeleteOpen(true)} className="p-3 w-50 h-50 bg-rose-500 hover:bg-rose-600 transition-all rounded-full"><Trash2 className='w-5 h-5' /></button>
      </div>
      <NodeCreate isOpen={open} onClose={() => setOpen(false)} />
      <AlertModal
        isOpen={deleteOpen} 
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
    </div>
    </div>
  )
}

export default ActionButtons
