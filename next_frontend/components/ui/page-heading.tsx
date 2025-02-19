import React from 'react'
import { Button } from './button'
import RedirectButton from './redirect-button'
import PublishButton from './publish-button'

interface PageHeadingProps {
  title: string
  description?: string
  createButton?: boolean
  button?: {
    label: string
    published: boolean
  }
  edit?: {
    action: () => void
  }
  redirect?: boolean
  redirectUrl?: string
  caseStudy?: any
}

export default function PageHeading({ title, description, createButton, button, edit, redirect, redirectUrl, caseStudy } : PageHeadingProps) {
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
        {button && <PublishButton label={button.label} published={button.published} caseStudy={caseStudy} />}
        {createButton && redirect && redirectUrl && <RedirectButton label={'Create'} url={redirectUrl} />}
      </div>
    </div>
  )
}
