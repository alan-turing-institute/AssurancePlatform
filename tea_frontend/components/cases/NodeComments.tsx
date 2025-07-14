'use client';

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import useStore from '@/data/store';
import {
  addEvidenceToClaim,
  addPropertyClaimToNested,
  attachCaseElement,
  deleteAssuranceCaseNode,
  removeAssuranceCaseNode,
  updateAssuranceCase,
  updateAssuranceCaseNode,
} from '@/lib/case-helper';
// import { useLoginToken } from '@/hooks/useAuth'
import {
  BookOpenText,
  Database,
  FolderOpenDot,
  Loader2,
  MessageCirclePlus,
  PlusIcon,
  Route,
  Trash,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { AlertModal } from '../modals/alertModal';
import CommentsForm from './CommentForm';
import CommentsFeed from './CommentsFeed';
import { Skeleton } from '../ui/skeleton';
import { useSession } from 'next-auth/react';

type NodeCommentProps = {
  node: any;
  handleClose: () => void;
  loadingState: {
    loading: boolean;
    setLoading: Dispatch<SetStateAction<boolean>>;
  };
  setAction: Dispatch<SetStateAction<string | null>>;
  readOnly: boolean;
};

const NodeComment = ({
  node,
  handleClose,
  loadingState,
  setAction,
  readOnly,
}: NodeCommentProps) => {
  const { loading, setLoading } = loadingState;
  const { assuranceCase, setAssuranceCase, nodeComments, setNodeComments } =
    useStore();
  const [filteredOrphanElements, setFilteredOrphanElements] = useState<any[]>(
    []
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  // const [token] = useLoginToken();
  const { data: session } = useSession();

  useEffect(() => {}, [node]);

  // Fetch Element Comments
  const fetchComments = async () => {
    setLoading(true);
    let entity = null;
    switch (node.type) {
      case 'context':
        entity = 'contexts';
        break;
      case 'strategy':
        entity = 'strategies';
        break;
      case 'property':
        entity = 'propertyclaims';
        break;
      case 'evidence':
        entity = 'evidence';
        break;
      default:
        entity = 'goals';
        break;
    }

    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${node.data.id}/comments/`;

      const requestOptions: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
      };
      const response = await fetch(url, requestOptions);
      const result = await response.json();
      return result;
    } catch (error) {
      console.log('Error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments().then((result) => setNodeComments(result));
  }, []);

  return (
    <div className="flex flex-col justify-start items-start mt-8">
      <h3 className="text-lg font-semibold mb-2">
        {!readOnly ? 'New Comment' : 'Comments'}
      </h3>
      {!readOnly && <CommentsForm node={node} />}
      {loading ? (
        <div className="py-8 flex flex-col justify-start gap-2 w-full">
          <Skeleton className="w-full h-[10px] rounded-full" />
          <Skeleton className="w-2/3 h-[10px] rounded-full" />
          <div className="flex justify-start items-center gap-2">
            <Skeleton className="w-[20px] h-[10px] rounded-full" />
            <Skeleton className="w-[100px] h-[10px] rounded-full" />
          </div>
        </div>
      ) : (
        <CommentsFeed node={node} />
      )}
    </div>
  );
};

export default NodeComment;
