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
import { existingImage } from '@/actions/capture'

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
  const [imageExists, setImageExists] = useState(true)

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

  useEffect(() => {
    const checkImageExists = async () => {
      try {
        const haveFile = await existingImage(`public/chart-screenshot-case-${assuranceCase.id}.png`)
        if (!haveFile) {
          // Image does not exist, set imageExists to false
          setImageExists(false);
        }
      } catch (error) {
        console.error('Error checking image existence:', error);
      }
    };

    checkImageExists();
  }, [id]);

  return (
    <div className='group relative'>
      <Link href={`/case/${assuranceCase.id}`}>
        <Card className='flex flex-col justify-start items-start group-hover:bg-indigo-500/5 transition-all h-full'>
          <CardHeader className='flex-1 w-full'>
            <div className='relative flex aspect-video rounded-md mb-4 overflow-hidden'>
              {/* <img src='https://images.unsplash.com/photo-1708844897353-649da595a3f2?q=80&w=3132&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' alt='' className='rounded-md mb-4' /> */}
              {/* <img src={`/chart-screenshot-case-${id}.png`} alt='' className='rounded-md mb-4 aspect-video' /> */}
              {/* <Image
                src={`/chart-screenshot-case-${id}.png`}
                alt={`Assurance Case ${assuranceCase.name} screenshot`}
                fill
                placeholder='blur'
                blurDataURL='/images/assurance-case-medium.png'
              /> */}
              {imageExists ? (
                <Image
                  src={`/chart-screenshot-case-${id}.png`}
                  alt={`Assurance Case ${assuranceCase.name} screenshot`}
                  fill
                />
              ) : (
                <Image
                  src="/images/assurance-case-medium.png"
                  alt="Default Image"
                  fill
                />
              )}
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
