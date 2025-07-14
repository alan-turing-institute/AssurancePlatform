'use client';

import MemberList from '@/components/team/MemberList';

const TeamPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
      <div className="w-full pt-6">
        <MemberList />
      </div>
    </div>
  );
};

export default TeamPage;
