'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

interface RedirectButtonProps {
  label: string;
  url: string;
}

const RedirectButton = ({ label, url }: RedirectButtonProps) => {
  const router = useRouter();

  return (
    <Link
      href={url}
      className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      {label}
    </Link>
  );
};

export default RedirectButton;
