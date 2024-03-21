import React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AssuranceCase } from '@/types'
import Link from 'next/link'

interface CaseCardProps {
  assuranceCase: AssuranceCase
}

const CaseCard = ({ assuranceCase } : CaseCardProps) => {
  const { id, title, description, created, image } = assuranceCase

  return (
    <Link href={'/'} className='group'>
      <Card className='group-hover:bg-indigo-500/5 transition-all'>
        <CardHeader>
          <img src='https://images.unsplash.com/photo-1708844897353-649da595a3f2?q=80&w=3132&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' alt='' className='rounded-md mb-4' />
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card Content</p>
        </CardContent>
        <CardFooter>
          <p>Created on: {created}</p>
        </CardFooter>
      </Card>
    </Link>
  )
}

export default CaseCard
