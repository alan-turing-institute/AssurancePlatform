'use client';

import { useEffect } from 'react';
import useStore from '@/data/store';
import ActionTooltip from '../ui/action-tooltip';

const ActiveUsersList = () => {
  const { activeUsers, setActiveUsers } = useStore();

  useEffect(() => {}, []);

  return (
    <div className="mr-6 flex items-center justify-start">
      {activeUsers?.map((user: any, index: number) => (
        <ActionTooltip key={user.user.id} label={user.user.username}>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-indigo-600 bg-white font-semibold text-foreground text-sm uppercase hover:cursor-pointer dark:border-slate-900 dark:bg-indigo-600 ${index > 0 ? '-ml-2' : ''}`}
          >
            {user.user.username.substring(0, 1)}
          </div>
        </ActionTooltip>
      ))}
    </div>
  );
};

export default ActiveUsersList;
