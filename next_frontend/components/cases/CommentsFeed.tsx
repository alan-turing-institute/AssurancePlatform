'use client'

import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { PencilLine,Trash2, User2Icon } from 'lucide-react'
import moment from 'moment'
import useStore from '@/data/store'
import { Button } from '../ui/button'
import { unauthorized, useLoginToken } from '@/hooks/useAuth'
import CommentsEditForm from './CommentsEditForm'
import { useToast } from '../ui/use-toast'
import { useSession } from 'next-auth/react'

type CommentsFeedProps = {
  node: any
}

export default function CommentsFeed({ node }: CommentsFeedProps) {
  const { assuranceCase, setAssuranceCase, nodeComments, setNodeComments } = useStore()
  // const [token] = useLoginToken();
  const { data: session } = useSession()
  const [edit, setEdit] = useState<boolean>(false)
  const [editId, setEditId] = useState<number>()
  const [user, setUser] = useState<any>()
  const { toast } = useToast();

  const handleNoteDelete = async (id: number) => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${id}/`

      const requestOptions: RequestInit = {
          method: "DELETE",
          headers: {
              Authorization: `Token ${session?.key}`,
              "Content-Type": "application/json",
          }
      };
      const response = await fetch(url, requestOptions);

      if(!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Unable to delete comment',
          description: 'Something went wrong trying to delete the comment.',
        });
        return
      }

      const updatedComments = nodeComments.filter((comment:any) => comment.id !== id)
      setNodeComments(updatedComments)
    } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Unable to delete comment',
          description: 'Something went wrong trying to delete the comment.',
        });
    }
  }

  useEffect(() => {},[nodeComments])

  const fetchCurrentUser = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${session?.key}`,
      },
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, requestOptions)

    if (response.status === 404 || response.status === 403) {
      console.log('Render Not Found Page')
      return
    }

    if (response.status === 401) return unauthorized()

    const result = await response.json()
    return result
  }

  // Fetch current user
  useEffect(() => {
    fetchCurrentUser().then(result => setUser(result))
  },[user])

  return (
    <div className="mt-4 py-2 w-full">
      {/* <p className='mb-6'>Exisitng comments</p> */}

      {nodeComments.length === 0 && (
        <p className='text-foreground/70'>No comments have been added.</p>
      )}

      <div className='w-full mb-16 flex flex-col justify-start items-start gap-3'>
      {nodeComments.map((comment: any) => (
        <div key={comment.id} className='p-3 text-foreground rounded-md w-full group hover:bg-indigo-500 hover:text-white transition-all duration-300 hover:cursor-pointer relative hover:pb-8'>
          {edit && editId === comment.id ? (
            <CommentsEditForm node={node} comment={comment} setEdit={setEdit} />
          ) : (
            <p className="whitespace-normal mb-1">{comment.content}</p>
          )}
          {edit && editId === comment.id ? (
            null
          ) : (
            <div className='text-muted-foreground group-hover:text-white text-xs flex justify-start items-center gap-2 transition-all duration-300 mt-3'>
              <User2Icon className='w-3 h-3'/>
              <div>
                {comment.author}
                <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                  <circle cx={1} cy={1} r={1} />
                </svg>
                {moment(new Date(comment.created_at)).format('DD/MM/YYYY')}
              </div>
            </div>
          )}
          {!edit && (
            assuranceCase.permissions !== 'view' && user?.username === comment.author && (
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
