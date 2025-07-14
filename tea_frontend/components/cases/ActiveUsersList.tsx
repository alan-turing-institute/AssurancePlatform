'use client';

import useStore from '@/data/store';
import React, { useEffect } from 'react';
import ActionTooltip from '../ui/action-tooltip';

const ActiveUsersList = () => {
  const { activeUsers, setActiveUsers } = useStore();

  useEffect(() => {
    console.log('Active user list updated.');
  }, [activeUsers]);

  return (
    <div className="flex justify-start items-center mr-6">
      {activeUsers &&
        activeUsers.map((user: any, index: number) => (
          <ActionTooltip label={user.user.username} key={user.user.id}>
            <div
              className={`dark:bg-indigo-600 bg-white text-foreground border-4 border-indigo-600 dark:border-slate-900 w-10 h-10 rounded-full uppercase font-semibold text-sm flex justify-center items-center hover:cursor-pointer ${index > 0 ? '-ml-2' : ''}`}
            >
              {user.user.username.substring(0, 1)}
            </div>
          </ActionTooltip>
        ))}
    </div>
  );
};

export default ActiveUsersList;
