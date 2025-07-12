'use client'

import React from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EllipsisVerticalIcon, EyeIcon } from 'lucide-react'
import Link from 'next/link'
import DeleteCaseButton from './delete-button'
import UnpublishCaseButton from './unpublish-button'

interface TableActionsProps {
  caseStudy: any
}

const TableActions = ({ caseStudy } : TableActionsProps ) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger><EllipsisVerticalIcon className='size-4' /></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link
            href={`case-studies/${caseStudy.id}`}
            className='flex items-center'
          >
            <EyeIcon className='size-4 mr-2'/>
            View
          </Link>
        </DropdownMenuItem>
        {caseStudy.published && (
          <DropdownMenuItem asChild>
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // prevents dropdown from closing immediately
              }}
            >
              <UnpublishCaseButton caseStudyId={caseStudy.id} />
            </div>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // prevents dropdown from closing immediately
            }}
          >
            <DeleteCaseButton caseStudyId={caseStudy.id} variant="link" />
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TableActions
