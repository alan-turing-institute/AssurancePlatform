import type React from 'react';
import CookieConsent from '@/components/cookie-consent';
import Header from './_components/header';
import PreviewBanner from './_components/preview-banner';

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
