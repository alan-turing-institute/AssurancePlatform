'use client';

import {
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
} from '@heroicons/react/20/solid';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import type { Context } from '@/types';

type NodeData = {
  id: number;
  type: string;
  name: string;
  short_description: string;
  long_description: string;
  assumption?: string;
  justification?: string;
  context?: Context[];
  parentId?: string;
};

interface IconIndicatorProps {
  data: NodeData;
}

const IconIndicator = ({ data }: IconIndicatorProps) => {
  const [comments, setComments] = useState([]);

  const { assumption, justification, type } = data;
  const { data: session } = useSession();

  const hasAssumptionOrJustificationOrContext =
    (typeof assumption === 'string' && assumption.trim() !== '') ||
    (typeof justification === 'string' && justification.trim() !== '') ||
    (Array.isArray(data.context) && data.context.length > 0);

  const fetchNodeComments = useCallback(async () => {
    let entity: string;

    switch (type) {
      case 'Strategy':
        entity = 'strategies';
        break;
      case 'PropertyClaim':
        entity = 'propertyclaims';
        break;
      case 'Evidence':
        entity = 'evidence';
        break;
      default:
        entity = 'goals';
        break;
    }

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${data.id}/comments/`;

      const requestOptions: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
      };

      const response = await fetch(url, requestOptions);
      const result = await response.json();
      // console.log('comments result', result)
      return result;
    } catch (_error) {
      // TODO: Handle error fetching comments
    }
  }, [data, session?.key, type]);

  useEffect(() => {
    fetchNodeComments().then((result) => {
      setComments(result);
    });
  }, [fetchNodeComments]);

  return (
    <div
      className={`inline-flex ${type === 'Strategy' ? 'top-0 right-0' : 'top-[6px] right-4'}`}
    >
      <div className="flex items-center justify-start gap-1">
        {hasAssumptionOrJustificationOrContext && (
          <InformationCircleIcon className="size-3 text-white/90" />
        )}
        {comments.length > 0 && (
          <ChatBubbleBottomCenterTextIcon className="size-3 text-white/90" />
        )}
      </div>
    </div>
  );
};

export default IconIndicator;
