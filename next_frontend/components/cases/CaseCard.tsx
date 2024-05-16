'use client'

import React, { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
// import { AssuranceCase } from '@/types'
import Link from 'next/link'
import moment from 'moment'
import { Trash2 } from 'lucide-react'
import { AlertModal } from '@/components/modals/alertModal'
import { useParams, useRouter } from 'next/navigation'
import { useLoginToken } from '@/hooks/useAuth'
import Image from 'next/image'

interface CaseCardProps {
  assuranceCase: any
}

const CaseCard = ({ assuranceCase } : CaseCardProps) => {
  const { id, name, description, created_date, image } = assuranceCase
  const [ token ] = useLoginToken()
  const params = useParams();
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imgSrc, setImgSrc] = useState(`https://teamedia.blob.core.windows.net/sample-container/chart-screenshot-case-${assuranceCase.id}.png`);
  // const [imageExists, setImageExists] = useState(true)
  // const [imageUrl, setImageUrl] = useState<string>('')

  // const imageUrl = `https://teamedia.blob.core.windows.net/sample-container/chart-screenshot-case-${assuranceCase.id}.png`

  const onDelete = async () => {
    try {
      setLoading(true);

      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${token}`,
        },
        method: "DELETE",
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/`, requestOptions)
      if(response.ok) {
        window.location.reload()
      }
    } catch (error: any) {
      console.log('ERROR!!!!', error)
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className='group relative min-h-[420px]'>
      <Link href={`/case/${assuranceCase.id}`}>
        <Card className='flex flex-col justify-start items-start group-hover:bg-indigo-500/5 transition-all h-full'>
          <CardHeader className='flex-1 w-full'>
            <div className='relative flex aspect-video rounded-md mb-4 overflow-hidden'>
              <Image
                src={imgSrc}
                alt={`Assurance Case ${assuranceCase.name} screenshot`}
                fill
                onError={() => {
                  setImgSrc('/images/assurance-case-medium.png');
                }}
              />
            </div>
            <CardTitle>{name}</CardTitle>
            <CardDescription className='text-slate-900 dark:text-white'>{description}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-end text-xs text-gray-500 dark:text-gray-300">
            <p>Created on: {moment(created_date).format('DD/MM/YYYY')}</p>
          </CardFooter>
        </Card>
      </Link>
      <button disabled={loading} onClick={() => setOpen(true)} className='absolute hidden group-hover:block top-4 right-4 bg-rose-500 text-white p-2 rounded-md shadow-lg z-50'>
        <Trash2 className='w-4 h-4' />
      </button>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
    </div>
  )
}

export default CaseCard
