'use client';

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
import { useSession } from 'next-auth/react';
import React, {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';
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
import { AlertModal } from '../modals/alertModal';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import CommentsForm from './CommentForm';
import CommentsFeed from './CommentsFeed';

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
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${node.data.id}/comments/`;

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
    <div className="mt-8 flex flex-col items-start justify-start">
      <h3 className="mb-2 font-semibold text-lg">
        {readOnly ? 'Comments' : 'New Comment'}
      </h3>
      {!readOnly && <CommentsForm node={node} />}
      {loading ? (
        <div className="flex w-full flex-col justify-start gap-2 py-8">
          <Skeleton className="h-[10px] w-full rounded-full" />
          <Skeleton className="h-[10px] w-2/3 rounded-full" />
          <div className="flex items-center justify-start gap-2">
            <Skeleton className="h-[10px] w-[20px] rounded-full" />
            <Skeleton className="h-[10px] w-[100px] rounded-full" />
          </div>
        </div>
      ) : (
        <CommentsFeed node={node} />
      )}
    </div>
  );
};

export default NodeComment;
