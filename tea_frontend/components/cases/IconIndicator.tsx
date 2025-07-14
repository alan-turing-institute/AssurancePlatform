'use client';

import useStore from '@/data/store';
import {
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
} from '@heroicons/react/20/solid';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';

interface IconIndicatorProps {
  data: any;
}

const IconIndicator = ({ data }: IconIndicatorProps) => {
  const [comments, setComments] = useState([]);

  const { assumption, justification, type } = data;
  const { data: session } = useSession();

  const hasAssumptionOrJustificationOrContext =
    (typeof assumption === 'string' && assumption.trim() !== '') ||
    (typeof justification === 'string' && justification.trim() !== '') ||
    (Array.isArray(data.context) && data.context.length > 0);

  const fetchNodeComments = async () => {
    let entity;

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
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${data.id}/comments/`;

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
    } catch (error) {
      console.log('Error', error);
    }
  };

  useEffect(() => {
    fetchNodeComments().then((result) => {
      setComments(result);
    });
  }, []);

  return (
    <div
      className={`inline-flex ${type === 'Strategy' ? 'top-0 right-0' : 'top-[6px] right-4'}`}
    >
      <div className="flex justify-start items-center gap-1">
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
