'use client';

import {
  Eye,
  Loader2,
  MessageCircleMore,
  PencilRuler,
  ScanEye,
  Trash2,
} from 'lucide-react';
import moment from 'moment';
// import { useLoginToken } from '@/hooks/useAuth'
import Image from 'next/image';
// import { AssuranceCase } from '@/types'
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { AlertModal } from '@/components/modals/alertModal';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';

interface CaseCardProps {
  assuranceCase: any;
}

const CaseCard = ({ assuranceCase }: CaseCardProps) => {
  const { id, name, description, created_date, image } = assuranceCase;
  // const [ token ] = useLoginToken()
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  // const [imgSrc, setImgSrc] = useState(`https://teamedia.blob.core.windows.net/sample-container/chart-screenshot-case-${assuranceCase.id}.png`);
  // const [imageExists, setImageExists] = useState(true)
  // const [imageUrl, setImageUrl] = useState<string>('')

  // const imageUrl = `https://teamedia.blob.core.windows.net/sample-container/chart-screenshot-case-${assuranceCase.id}.png`

  const onDelete = async () => {
    try {
      setLoading(true);

      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${session?.key}`,
        },
        method: 'DELETE',
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`,
        requestOptions
      );
      if (response.ok) {
        window.location.reload();
      }
    } catch (error: any) {
      console.log('ERROR!!!!', error);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const fetchScreenshot = async () => {
    try {
      const requestOptions: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: `Token ${session?.key}`,
        },
        redirect: 'follow',
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cases/${id}/image`,
        requestOptions
      );

      if (response.status == 404) {
        setImgSrc('/images/assurance-case-medium.png');
        return;
      }

      const result = await response.json();
      setImgSrc(result.image);
    } catch (error) {
      console.log('Failed to fetch image');
    } finally {
      setImageLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenshot();
  });

  return (
    <div className="group relative min-h-[420px]">
      <Link href={`/case/${assuranceCase.id}`}>
        <Card className="flex h-full flex-col items-start justify-start transition-all group-hover:bg-indigo-500/5">
          <CardHeader className="w-full flex-1">
            {imageLoading ? (
              <Skeleton className="relative mb-4 flex aspect-video overflow-hidden rounded-md" />
            ) : (
              <div className="relative mb-4 flex aspect-video overflow-hidden rounded-md">
                {imgSrc && (
                  <Image
                    alt={`Assurance Case ${assuranceCase.name} screenshot`}
                    fill
                    src={imgSrc}
                  />
                )}
              </div>
            )}
            <CardTitle>{name}</CardTitle>
            <CardDescription className="text-slate-900 dark:text-white">
              {description}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex w-full items-center justify-between text-gray-500 text-xs dark:text-gray-300">
            <p>Created on: {moment(created_date).format('DD/MM/YYYY')}</p>
            <div className="flex items-center justify-start gap-2">
              {assuranceCase.permissions.includes('view') && (
                <Eye className="h-4 w-4" />
              )}
              {assuranceCase.permissions.includes('review') && (
                <MessageCircleMore className="h-4 w-4" />
              )}
              {assuranceCase.permissions.includes('edit') && (
                <PencilRuler className="h-4 w-4" />
              )}
            </div>
          </CardFooter>
        </Card>
      </Link>
      {(assuranceCase.permissions.includes('owner') ||
        assuranceCase.permissions.includes('editor')) && (
        <button
          className="absolute top-4 right-4 z-50 hidden rounded-md bg-rose-500 p-2 text-white shadow-lg group-hover:block"
          disabled={loading}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <AlertModal
        confirmButtonText={'Delete'}
        isOpen={open}
        loading={loading}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
      />
    </div>
  );
};

export default CaseCard;
