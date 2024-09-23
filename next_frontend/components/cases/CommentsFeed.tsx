'use client'

import { useEffect, useState } from 'react'
import { PencilLine,Trash2, User2Icon } from 'lucide-react'
import moment from 'moment'
import useStore from '@/data/store'
import { Button } from '../ui/button'
import { useLoginToken } from '@/hooks/useAuth'
import CommentsEditForm from './CommentsEditForm'

type CommentsFeedProps = {
  node: any
}

export default function CommentsFeed({ node }: CommentsFeedProps) {
  const { assuranceCase, setAssuranceCase } = useStore()
  const [token] = useLoginToken();
  const [edit, setEdit] = useState<boolean>(false)
  const [editId, setEditId] = useState<number>()

  //@ts-ignore
  assuranceCase.comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  useEffect(() => {
    //@ts-ignore
    assuranceCase.comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },[assuranceCase])

  const handleNoteDelete = async (id: number) => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/comments/${id}/`

      const requestOptions: RequestInit = {
          method: "DELETE",
          headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
          }
      };
      const response = await fetch(url, requestOptions);

      if(!response.ok) {
          console.log('error')
      }

      const updatedComments = assuranceCase.comments.filter((comment:any) => comment.id !== id)

      const updatedAssuranceCase = {
        ...assuranceCase,
        comments: updatedComments
      }

      setAssuranceCase(updatedAssuranceCase)
    } catch (error) {
        console.log('Error', error)
    }
  }

  const comments = [
    { id: 1, comment: 'Lorem ipsum odor amet, consectetuer adipiscing elit. Tellus neque venenatis; maximus ultricies augue potenti. Est eu posuere metus diam purus facilisi.', user: { name: 'Rich' }, createdOn: new Date() },
    { id: 2, comment: 'Lorem ipsum odor amet, consectetuer adipiscing elit. Tellus neque venenatis; maximus ultricies augue potenti. Est eu posuere metus diam purus facilisi. Lorem ipsum odor amet, consectetuer adipiscing elit. Tellus neque venenatis; maximus ultricies augue potenti. Est eu posuere metus diam purus facilisi.', user: { name: 'Rich' }, createdOn: new Date() },
    { id: 3, comment: 'Testing comment', user: { name: 'Rich' }, createdOn: new Date() },
    { id: 4, comment: 'Lorem ipsum odor amet, consectetuer adipiscing elit. Tellus neque venenatis; maximus ultricies augue potenti. Est eu posuere metus diam purus facilisi.', user: { name: 'Rich' }, createdOn: new Date() },
    { id: 5, comment: 'Testing comment', user: { name: 'Rich' }, createdOn: new Date() },
    { id: 6, comment: 'Lorem ipsum odor amet, consectetuer adipiscing elit. Tellus neque venenatis; maximus ultricies augue potenti. Est eu posuere metus diam purus facilisi.', user: { name: 'Rich' }, createdOn: new Date() },
    { id: 7, comment: 'Testing comment', user: { name: 'Rich' }, createdOn: new Date() },
  ]

  return (
    <div className="mt-4 py-2 w-full">
      {/* <p className='mb-6'>Exisitng comments</p> */}

      {comments.length === 0 && (
        <p className='text-foreground/70'>No comments have been added.</p>
      )}

      <div className='w-full mb-16 flex flex-col justify-start items-start gap-3'>
      {comments.map((comment: any) => (
        <div key={comment.id} className='p-3 text-foreground rounded-md w-full group hover:bg-indigo-500 hover:text-white transition-all duration-300 hover:cursor-pointer relative hover:pb-8'>
          {edit && editId === comment.id ? (
            <CommentsEditForm node={node} comment={comment} setEdit={setEdit} />
          ) : (
            <p className="whitespace-normal mb-1">{comment.comment}</p>
          )}
          {edit && editId === comment.id ? (
            null
          ) : (
            <div className='text-muted-foreground group-hover:text-white text-xs flex justify-start items-center gap-2 transition-all duration-300 mt-3'>
              <User2Icon className='w-3 h-3'/>
              <div>
                {comment.user.name} 
                <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                  <circle cx={1} cy={1} r={1} />
                </svg>
                {moment(new Date(comment.createdOn)).format('DD/MM/YYYY')}
              </div>
            </div>
          )}
          {!edit && (
            assuranceCase.permissions !== 'view' && (
              <div className='hidden group-hover:block absolute bottom-2 right-2'>
                <div className='flex justify-start items-center gap-2'>
                  <Button 
                    onClick={() => {
                      setEdit(!edit)
                      setEditId(comment.id)
                    }} 
                    variant={'ghost'}
                    size={'sm'}
                    className='hover:bg-indigo-800/50'
                  >
                    <PencilLine className='w-4 h-4'/>
                  </Button>
                  <Button onClick={() => handleNoteDelete(comment.id)} size={'icon'} variant={'destructive'}><Trash2 className='w-4 h-4'/></Button>
                </div>
              </div>
            )
          )}
        </div>
      ))}
      </div>
    </div>
  )
}
