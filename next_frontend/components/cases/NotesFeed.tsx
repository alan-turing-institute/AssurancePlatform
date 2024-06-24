'use client'

import { Fragment, useEffect, useState } from 'react'
import { ChatBubbleLeftEllipsisIcon, TagIcon, UserCircleIcon } from '@heroicons/react/20/solid'
import { Edit2, Pencil, PencilLine, PhoneOffIcon, Save, Trash2, User2Icon, X } from 'lucide-react'
import moment from 'moment'
import useStore from '@/data/store'
import { Button } from '../ui/button'
import { useLoginToken } from '@/hooks/useAuth'
import { boolean } from 'zod'
import NotesEditField from './NotesEditForm'
import NotesEditForm from './NotesEditForm'

// const activity = [
//   {
//     id: 1,
//     type: 'comment',
//     person: { name: 'System User', href: '#' },
//     imageUrl:
//       'https://images.unsplash.com/photo-1520785643438-5bf77931f493?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80',
//     comment:
//       'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tincidunt nunc ipsum tempor purus vitae id. Morbi in vestibulum nec varius. Et diam cursus quis sed purus nam. ',
//     date: '01/01/2001',
//   },
//   // {
//   //   id: 2,
//   //   type: 'assignment',
//   //   person: { name: 'Hilary Mahy', href: '#' },
//   //   assigned: { name: 'Kristin Watson', href: '#' },
//   //   date: '2d ago',
//   // },
//   // {
//   //   id: 3,
//   //   type: 'tags',
//   //   person: { name: 'Hilary Mahy', href: '#' },
//   //   tags: [
//   //     { name: 'Bug', href: '#', color: 'fill-red-500' },
//   //     { name: 'Accessibility', href: '#', color: 'fill-indigo-500' },
//   //   ],
//   //   date: '6h ago',
//   // },
//   {
//     id: 4,
//     type: 'comment',
//     person: { name: 'System User', href: '#' },
//     imageUrl:
//       'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80',
//     comment:
//       'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tincidunt nunc ipsum tempor purus vitae id. Morbi in vestibulum nec varius. Et diam cursus quis sed purus nam. Scelerisque amet elit non sit ut tincidunt condimentum. Nisl ultrices eu venenatis diam.',
//     date: '01/01/2001',
//   },
// ]

export default function NotesFeed({ }) {
  const { assuranceCase, setAssuranceCase } = useStore()
  const [token] = useLoginToken();
  const [edit, setEdit] = useState<boolean>()
  const [editId, setEditId] = useState<number>()
  const [newComment, setNewComment] = useState<string>()

  //@ts-ignore
  assuranceCase.comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  useEffect(() => {
    //@ts-ignore
    assuranceCase.comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },[assuranceCase])

  const handleNoteDelete = async (id: number) => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${id}/`

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

  return (
    <div className="mt-4 py-8 px-4">
      <ul role="list" className="-mb-8">
        {assuranceCase.comments.length === 0 && (
          <p className='text-foreground/70'>No notes have been added.</p>
        )}
        {assuranceCase.comments.map((activityItem: any, activityItemIdx: any) => (
          <li key={crypto.randomUUID()}>
            <div className="relative pb-8 group">
              {activityItemIdx !== assuranceCase.comments.length - 1 ? (
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
                        {activityItem.author}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/70">Created On: {moment(new Date(activityItem.created_at)).format('DD/MM/YYYY')}</p>
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {edit && editId === activityItem.id ? (
                      <NotesEditForm note={activityItem} setEdit={setEdit} />
                    ) : (
                      <p className="whitespace-normal">{activityItem.content}</p>
                    )}

                  </div>
                </div>
                {!edit && (
                <div className='hidden group-hover:flex justify-center items-center gap-2'>
                  <Button onClick={() => {
                    setEdit(!edit)
                    setEditId(activityItem.id)
                  }} size={'icon'} className='bg-background hover:bg-background/50 text-foreground'>
                    <PencilLine className='w-4 h-4'/>
                  </Button>
                  <Button onClick={() => handleNoteDelete(activityItem.id)} size={'icon'} variant={'destructive'}><Trash2 className='w-4 h-4'/></Button>
                </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
