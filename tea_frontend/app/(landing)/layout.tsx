import type React from 'react';
import CookieConsent from '@/components/CookieConsent';
import Header from './_components/Header';
import PreviewBanner from './_components/PreviewBanner';

const LandingLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      {children}
      <PreviewBanner />
      <CookieConsent />
    </div>
  );
};

export default LandingLayout;
