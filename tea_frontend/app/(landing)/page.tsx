import CTA from '@/components/demo/landing/CTA';
import FAQ from '@/components/demo/landing/Faq';
import Features from '@/components/demo/landing/Features';
import Footer from '@/components/demo/landing/Footer';
import Hero from '@/components/demo/landing/Hero';
import MailingList from '@/components/demo/landing/MalingList';
import React from 'react';

const LandingPage = () => {
  return (
    <>
      <Hero />
      <Features />
      <CTA />
      {/* <FAQ /> */}
      {/* <MailingList /> */}
      <Footer />
    </>
  );
};

export default LandingPage;
