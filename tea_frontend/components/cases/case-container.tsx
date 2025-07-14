'use client';

import { unauthorized } from '.*/use-auth';
import { Loader2, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import WebSocketComponent from '@/components/websocket';
import useStore from '@/data/store';
import { addHiddenProp } from '@/lib/case-helper';
import Header from '../header';
import CaseDetails from './case-details';
import Flow from './flow';

interface CaseContainerProps {
  caseId?: string;
}

const CaseContainer = ({ caseId }: CaseContainerProps) => {
  // const [assuranceCase, setAssuranceCase] = useState<any>()
  const [loading, setLoading] = useState(true);
  const { assuranceCase, setAssuranceCase, setOrphanedElements } = useStore();
  const [open, setOpen] = useState(false);

  const params = useParams();
  const { caseId: paramsCaseId } = params;

  const { data: session } = useSession();

  // const [token] = useLoginToken();
  // useEnforceLogin()

  const fetchSingleCase = useCallback(
    async (id: number) => {
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${session?.key}`,
        },
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${id}/`,
        requestOptions
      );

      if (response.status === 404 || response.status === 403) {
        return;
      }

      if (response.status === 401) {
        return unauthorized();
      }

      const result = await response.json();

      const formattedAssuranceCase = await addHiddenProp(result);
      return formattedAssuranceCase;
    },
    [session?.key]
  );

  const fetchOrphanedElements = useCallback(
    async (id: string | number) => {
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${session?.key}`,
        },
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${id}/sandbox`,
        requestOptions
      );

      if (response.status === 404 || response.status === 403) {
        return;
      }

      if (response.status === 401) {
        return unauthorized();
      }

      const result = await response.json();
      return result;
    },
    [session?.key]
  );

  useEffect(() => {
    //@ts-expect-error
    fetchSingleCase(caseId || paramsCaseId).then((result) => {
      setAssuranceCase(result);
      setLoading(false);
    });
  }, [caseId, paramsCaseId, fetchSingleCase, setAssuranceCase]);

  useEffect(() => {
    fetchOrphanedElements(caseId || paramsCaseId).then((result) => {
      setOrphanedElements(result);
    });
  }, [caseId, paramsCaseId, fetchOrphanedElements, setOrphanedElements]);

  return (
    <>
      {(() => {
        if (loading) {
          return (
            <div className="flex min-h-screen items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Rendering your chart...</p>
              </div>
            </div>
          );
        }
        if (assuranceCase) {
          return (
            <ReactFlowProvider>
              <Header setOpen={setOpen} />
              <Flow />
              <CaseDetails isOpen={open} setOpen={setOpen} />
              <FeedbackButton />
              <WebSocketComponent />
            </ReactFlowProvider>
          );
        }
        return <p>No Case Found</p>;
      })()}
    </>
  );
};

const FeedbackButton = () => {
  return (
    <Link
      href={
        'https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/'
      }
      target="_blank"
    >
      <div className="absolute right-4 bottom-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 shadow-xl hover:cursor-pointer">
        <MessagesSquare className="h-6 w-6 text-white" />
        <div className="-z-10 absolute h-16 w-16 animate-pulse rounded-full bg-violet-500" />
      </div>
    </Link>
  );
};

export default CaseContainer;
