'use client';

import { useEffect } from 'react';
import { useEmailModal } from '@/hooks/useEmailModal';

interface CheckUserEmailProps {
  user: any;
}

const CheckUserEmail = ({ user }: CheckUserEmailProps) => {
  const emailModal = useEmailModal();

  useEffect(() => {
    if (!user?.email) emailModal.onOpen();
  }, [user, emailModal]);

  return null;
};

export default CheckUserEmail;
