import React from 'react'
import { Button } from './button'

interface PageHeadingProps {
  title: string
  description?: string
  button?: {
    label: string
    action: () => void
  }
  edit?: {
    action: () => void
  }
}

export default function PageHeading({ title, description, button, edit } : PageHeadingProps) {
  return (
    <div className="md:flex md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold text-foreground sm:truncate">
          {title}
        </h2>
        {description && <p className='mt-2 text-muted-foreground text-sm'>{description}</p>}
      </div>
      <div className="mt-4 flex md:ml-4 md:mt-0">
        {edit && 
          <Button variant={'ghost'}>Edit</Button>
        }
        {button && <button
          type="button"
          className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {button.label}
        </button>}
      </div>
    </div>
  )
}
