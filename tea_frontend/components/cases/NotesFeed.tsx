'use client'

import { Fragment, useEffect, useState } from 'react'
import { ChatBubbleLeftEllipsisIcon, TagIcon, UserCircleIcon } from '@heroicons/react/20/solid'
import { Edit2, Pencil, PencilLine, PhoneOffIcon, Save, Trash2, User2Icon, X } from 'lucide-react'
import moment from 'moment'
import useStore from '@/data/store'
import { Button } from '../ui/button'
import { unauthorized, useLoginToken } from '@/hooks/useAuth'
import { boolean } from 'zod'
import NotesEditField from './NotesEditForm'
import NotesEditForm from './NotesEditForm'
import { useToast } from '../ui/use-toast'
import { useSession } from 'next-auth/react'

export default function NotesFeed({ }) {
  const { assuranceCase, setAssuranceCase, caseNotes, setCaseNotes } = useStore()
  // const [token] = useLoginToken();
  const { data: session } = useSession()
  const [edit, setEdit] = useState<boolean>()
  const [editId, setEditId] = useState<number>()
  const [newComment, setNewComment] = useState<string>()
  const [comments, setComments] = useState([])
  const [user, setUser] = useState<any>()
  const { toast } = useToast();

  //@ts-ignore
  assuranceCase.comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const fetchSingleCase = async () => {
    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${session?.key}`,
      },
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/`, requestOptions);

    if(response.status === 404 || response.status === 403 ) {
      // TODO: 404 NOT FOUND PAGE
      console.log('Render Not Found Page')
      return
    }

    if(response.status === 401) return unauthorized()

    const { comments } = await response.json()
    return comments
  }

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

  // Fetch case notes/comments
  useEffect(() => {
    //@ts-ignore
    // assuranceCase.comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    fetchSingleCase().then(comments => setCaseNotes(comments))
  },[caseNotes])

  // Fetch current user
  useEffect(() => {
    fetchCurrentUser().then(result => setUser(result))
  },[user])

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

      const updatedComments = caseNotes.filter((comment:any) => comment.id !== id)
      setCaseNotes(updatedComments)
    } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Unable to delete comment',
          description: 'Something went wrong trying to delete the comment.',
        });
    }
  }

  return (
    <div className="mt-4 py-8 px-4">
      <ul role="list" className="-mb-8">
        {caseNotes.length === 0 && (
          <p className='text-foreground/70'>No notes have been added.</p>
        )}
        {caseNotes.map((note: any, index: any) => (
          <li key={note.id}>
            <div className="relative pb-8 group">
              {index !== caseNotes.length - 1 ? (
                <span className="absolute left-9 top-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
              ) : null}
              <div className="relative flex justify-start items-start space-x-3 p-4 rounded-md group-hover:bg-gray-100/50 dark:group-hover:bg-foreground/10">
                <div className="relative mr-4">
                  {/* <img
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white"
                    src={activityItem.imageUrl}
                    alt=""
                  /> */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 ring-8 ring-white dark:ring-slate-900">
                    <User2Icon className='w-4 h-4 text-white' />
                  </div>

                  {/* <span className="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
                    <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span> */}
                </div>
                <div className="min-w-0 flex-1">
                  <div>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {note.author}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/70">Created On: {moment(new Date(note.created_at)).format('DD/MM/YYYY')}</p>
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {edit && editId === note.id ? (
                      <NotesEditForm note={note} setEdit={setEdit} />
                    ) : (
                      <p className="whitespace-normal">{note.content}</p>
                    )}

                  </div>
                </div>
                {!edit && (
                  assuranceCase.permissions !== 'view' && user?.username === note.author && (
                    <div className='hidden group-hover:flex justify-center items-center gap-2'>
                      <Button onClick={() => {
                        setEdit(!edit)
                        setEditId(note.id)
                      }} size={'icon'} className='bg-background hover:bg-background/50 text-foreground'>
                        <PencilLine className='w-4 h-4'/>
                      </Button>
                      <Button onClick={() => handleNoteDelete(note.id)} size={'icon'} variant={'destructive'}><Trash2 className='w-4 h-4'/></Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
