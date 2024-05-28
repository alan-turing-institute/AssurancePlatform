import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Check, MessageSquareMore, X } from 'lucide-react';
import { ModeToggle } from './ui/theme-toggle';
import { useRouter } from 'next/navigation';
import { useLoginToken } from '@/hooks/useAuth';
import useStore from '@/data/store';
import { CaseNavigation } from './cases/CaseNavigation';
import Link from 'next/link';

interface HeaderProps {}

const Header = ({ }: HeaderProps) => {
  const { assuranceCase, setAssuranceCase } = useStore();
  const router = useRouter();
  const [editName, setEditName] = useState<boolean>(false);
  const [newCaseName, setNewCaseName] = useState<string>(assuranceCase.name);
  const inputRef = useRef<HTMLInputElement>(null);


  const [token] = useLoginToken();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCaseName(e.target.value);
  };

  const handleEditClick = () => {
    setEditName(!editName);
  };

  const updateAssuranceCaseName = async () => {
    try {
      const newData = {
        name: newCaseName
      }
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/`
      const requestOptions: RequestInit = {
          method: "PUT",
          headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
          },
          body: JSON.stringify(newData)
      };

      const response = await fetch(url, requestOptions);
      if(!response.ok) {
        console.log('Render a new error')
      }
      setEditName(false)
      setAssuranceCase({ ...assuranceCase, name: newCaseName })
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <div className='fixed top-0 left-0 bg-indigo-600 dark:bg-slate-900 text-white w-full z-50'>
      <div className='container py-3 flex justify-between items-center'>
        <div className='flex justify-start items-center gap-2'>
          <Button variant={'ghost'} size={'icon'} onClick={() => router.push('/dashboard')} className='hover:bg-indigo-900/20 hover:dark:bg-gray-100/10 hover:text-white'>
            <ArrowLeft className='w-4 h-4' />
          </Button>
          {editName ? (
            <div className='flex justify-start items-center gap-4'>
              <input
                ref={inputRef}
                type='text'
                name='newCaseName'
                value={newCaseName}
                onChange={handleInputChange}
                className={`bg-transparent rounded-md border border-indigo-500 focus:border-indigo-500 outline-none px-4 py-2`}
              />
              <div className='flex justify-start items-center'>
                <Button variant={'ghost'} size={'icon'} onClick={updateAssuranceCaseName}><Check className='w-4 h-4 text-emerald-500'/></Button>
                <Button variant={'ghost'} size={'icon'} onClick={handleEditClick}><X className='w-4 h-4'/></Button>
              </div>
            </div>
          ) : (
            <p className='font-semibold' onClick={handleEditClick}>
              {assuranceCase.name}
            </p>
          )}
        </div>

        <div className='flex justify-start items-center gap-4'>
          <CaseNavigation />
          <Link 
            href={'https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/'}
            target='_blank'
            className='flex justify-center items-center gap-2 bg-indigo-600 text-white py-2 px-3 rounded-md'
          >
            <MessageSquareMore className='w-4 h-4' />
            <span className="font-medium text-sm">Feedback</span>
          </Link>
          <ModeToggle className='bg-indigo-500 dark:bg-slate-900 hover:bg-indigo-900/20 hover:dark:bg-gray-100/10 hover:text-white border-none' />
        </div>
      </div>
    </div>
  );
};

export default Header;
