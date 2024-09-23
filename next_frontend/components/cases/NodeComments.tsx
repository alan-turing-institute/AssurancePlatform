'use client'

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import useStore from '@/data/store'
import { addEvidenceToClaim, addPropertyClaimToNested, attachCaseElement, deleteAssuranceCaseNode, removeAssuranceCaseNode, updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'
import { useLoginToken } from '@/hooks/useAuth'
import { BookOpenText, Database, FolderOpenDot, Loader2, MessageCirclePlus, PlusIcon, Route, Trash, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { AlertModal } from '../modals/alertModal'
import CommentsForm from './CommentForm'
import CommentsFeed from './CommentsFeed'

type NodeCommentProps = {
  node: any
  handleClose: () => void
  loadingState: {
    loading: boolean
    setLoading: Dispatch<SetStateAction<boolean>>
  }
  setAction: Dispatch<SetStateAction<string | null>>
  readOnly: boolean
}

const NodeComment = ({ node, handleClose, loadingState, setAction, readOnly } : NodeCommentProps) => {
  const { loading, setLoading } = loadingState
  const { assuranceCase, setAssuranceCase } = useStore();
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<any[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [token] = useLoginToken();

  useEffect(() => {
    
  }, [node])

  return (
    <div className="flex flex-col justify-start items-start mt-8">
      <h3 className="text-lg font-semibold mb-2">
        {!readOnly ? 'New Comment' : 'Comments'}</h3>
      {!readOnly && <CommentsForm node={node} />}
      <CommentsFeed node={node} />
    </div>
  )
}

export default NodeComment
