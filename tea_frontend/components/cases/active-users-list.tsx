'use client';

import useStore from '@/data/store';
import ActionTooltip from '../ui/action-tooltip';

const ActiveUsersList = () => {
  const { activeUsers } = useStore();

  return (
    <div className="mr-6 flex items-center justify-start">
      {activeUsers?.map((user, index: number) => (
        <ActionTooltip key={user.id} label={user.username}>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-indigo-600 bg-white font-semibold text-foreground text-sm uppercase hover:cursor-pointer dark:border-slate-900 dark:bg-indigo-600 ${index > 0 ? '-ml-2' : ''}`}
          >
            {user.username.substring(0, 1)}
          </div>
        </ActionTooltip>
      ))}
    </div>
  );
};

export default ActiveUsersList;
