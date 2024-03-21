import React from 'react'
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

interface CaseCardProps {
  assuranceCase: any
}

const CaseCard = ({ assuranceCase } : CaseCardProps) => {
  const { id, name, description, created, image } = assuranceCase

  return (
    <Link href={'/'} className='group'>
      <Card className='flex flex-col justify-start items-start group-hover:bg-indigo-500/5 transition-all h-full'>
        <CardHeader className='flex-1'>
          <img src='https://images.unsplash.com/photo-1708844897353-649da595a3f2?q=80&w=3132&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' alt='' className='rounded-md mb-4' />
          <CardTitle>{name}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          <p>Created on: {created}</p>
        </CardFooter>
      </Card>
    </Link>
  )
}

export default CaseCard
