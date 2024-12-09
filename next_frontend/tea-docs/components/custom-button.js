
import { MoveRightIcon } from 'lucide-react'

export const CustomButton = ({children, url}) => {
  return (
    <a
      href={url}
      target='_blank'
      className='inline-flex my-3 bg-indigo-600 text-white py-2 px-4 rounded-md hover:text-white hover:bg-indigo-700 hover:cursor-pointer hover:no-underline justify-center items-center gap-2'
    >
    {children}
    <MoveRightIcon className='size-4' />
  </a>
  )
}

