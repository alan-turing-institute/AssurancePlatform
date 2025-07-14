import React, { type ReactNode } from 'react';
import { FeedbackForm } from './_components/FeedbackForm';

const FeedbackLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative min-h-screen bg-grid-paper dark:bg-grid-paper-dark">
      {/* Your content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        {/* Your content here */}
        <FeedbackForm />
      </div>
    </div>
  );
};

export default FeedbackLayout;
