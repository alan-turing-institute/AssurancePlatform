'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from './button';

interface BackButtonProps {
  url?: string;
}

export default function BackButton({ url }: BackButtonProps) {
  const router = useRouter();

  const redirectUrl = url ? url : '/dashboard';

  return (
    <Button
      className="mb-8 flex items-center justify-start gap-2"
      onClick={() => router.push(redirectUrl)}
      variant={'outline'}
    >
      <ArrowLeftIcon className="size-4" />
      Back
    </Button>
  );
}
