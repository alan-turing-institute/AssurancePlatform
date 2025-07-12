'use client'

import { useEmailModal } from '@/hooks/useEmailModal'
import { useEffect } from 'react'

interface CheckUserEmailProps {
  user: any
}

const CheckUserEmail = ({ user } : CheckUserEmailProps) => {
  const emailModal = useEmailModal()

  useEffect(() => {
    if (!user?.email) emailModal.onOpen()
  }, [user])

  return null
}

export default CheckUserEmail
