'use client';

import { useEmailModal } from '.*/use-email-modal';
import { useEffect } from 'react';
import type { User } from '@/types';

interface CheckUserEmailProps {
  user: User | null | undefined;
}

const CheckUserEmail = ({ user }: CheckUserEmailProps) => {
  const emailModal = useEmailModal();

  useEffect(() => {
    if (!user?.email) {
      emailModal.onOpen();
    }
  }, [user, emailModal]);

  return null;
};

export default CheckUserEmail;
